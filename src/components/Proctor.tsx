import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Camera, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { flushAdminEmails } from "@/lib/notify.functions";

const flush = () => { void flushAdminEmails().catch(() => {}); };

const SNAP_MS = 75_000;
const LIVE_MS = 5_000;
const CLIP_MS = 30_000;
const FLUSH_MS = 120_000;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["video/webm;codecs=vp8", "video/webm", "video/mp4"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

type ProctorState = { stream: MediaStream | null; switches: number };
const ProctorCtx = createContext<ProctorState>({ stream: null, switches: 0 });
export const useProctor = () => useContext(ProctorCtx);

/** Live camera tile that mirrors the proctor stream. Place it anywhere inside <Proctor>. */
export function CameraMonitor({ className = "" }: { className?: string }) {
  const { stream, switches } = useContext(ProctorCtx);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && stream) { ref.current.srcObject = stream; void ref.current.play().catch(() => {}); } }, [stream]);
  return (
    <div className={"overflow-hidden rounded-2xl border-2 border-primary/40 bg-card shadow-sm " + className}>
      <div className="relative aspect-[4/3] bg-muted">
        <video ref={ref} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive-foreground" />REC</span>
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <span className="flex items-center gap-1 font-bold"><Camera className="h-3.5 w-3.5 text-primary" />Live Monitor</span>
        {switches > 0 ? <span className="flex items-center gap-1 font-bold text-destructive"><AlertTriangle className="h-3 w-3" />{switches} tab switch{switches === 1 ? "" : "es"}</span> : <span className="text-success font-bold">All clear</span>}
      </div>
    </div>
  );
}

/** Blocks the exam until the camera is on, then takes periodic snapshots and logs tab switches. */
export function Proctor({ attemptId, studentId, children }: { attemptId: string; studentId: string; children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [switches, setSwitches] = useState(0);

  const log = useCallback(async (kind: string, photo_path: string | null = null) => {
    await supabase.from("proctor_events").insert({ attempt_id: attemptId, student_id: studentId, kind, photo_path });
  }, [attemptId, studentId]);

  const snap = useCallback(async (kind: "snapshot" | "live" = "snapshot") => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    const w = kind === "live" ? 480 : 320;
    c.width = w; c.height = Math.round((w * v.videoHeight) / v.videoWidth);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.6));
    if (!blob) return;
    const path = `${studentId}/${attemptId}/${kind === "live" ? "live-" : ""}${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("proctor").upload(path, blob, { contentType: "image/jpeg" });
    if (!error) await log(kind, path);
  }, [attemptId, studentId, log]);

  const start = useCallback(async () => {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640 }, audio: false });
      streamRef.current = s;
      s.getVideoTracks()[0]?.addEventListener("ended", () => { setReady(false); void log("camera_off").then(flush); });
      void document.documentElement.requestFullscreen?.().catch(() => {});
      setReady(true);
    } catch {
      setErr("Camera access was blocked. Allow the camera in your browser settings, then tap the button again.");
    }
  }, [log]);

  useEffect(() => {
    if (ready && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const first = setTimeout(() => void snap(), 3000);
    const t = setInterval(() => void snap(), SNAP_MS);
    const live = setInterval(() => void snap("live"), LIVE_MS);
    const f = setInterval(flush, FLUSH_MS);
    flush();
    return () => { clearTimeout(first); clearInterval(t); clearInterval(live); clearInterval(f); };
  }, [ready, snap]);

  // Continuous recording, cut into 30-second clips so each one uploads on its own.
  useEffect(() => {
    const stream = streamRef.current;
    const mime = pickMime();
    if (!ready || !stream || !mime) return;
    let stopped = false;
    let rec: MediaRecorder | null = null;
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const startClip = () => {
      if (stopped) return;
      const chunks: Blob[] = [];
      const started = Date.now();
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 200_000 });
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        startClip();
        const blob = new Blob(chunks, { type: mime.split(";")[0] ?? mime });
        if (!blob.size) return;
        const path = `${studentId}/${attemptId}/video-${started}.${ext}`;
        const { error } = await supabase.storage.from("proctor").upload(path, blob, { contentType: blob.type });
        if (!error) await log("video", path);
      };
      rec.start();
      setTimeout(() => { if (rec && rec.state === "recording") rec.stop(); }, CLIP_MS);
    };
    startClip();
    const onHide = () => { if (rec && rec.state === "recording") rec.stop(); };
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); stopped = true; if (rec && rec.state === "recording") rec.stop(); };
  }, [ready, attemptId, studentId, log]);

  useEffect(() => {
    if (!ready) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        setSwitches((n) => n + 1);
        void log("tab_switch").then(flush);
        toast.warning("Leaving the test page is recorded and reported to your examiner.");
      }
    };
    const onFs = () => {
      if (!document.fullscreenElement) {
        setSwitches((n) => n + 1);
        void log("tab_switch").then(flush);
        toast.warning("You left full screen. This is recorded. Tap anywhere to return.");
      }
    };
    const refs = () => { if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {}); };
    const block = (e: Event) => e.preventDefault();
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("click", refs);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("click", refs);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      window.removeEventListener("beforeunload", unload);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [ready, log]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-2xl border bg-card p-6 text-center">
          <Camera className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Camera required</h1>
          <p className="mt-2 text-muted-foreground">This exam is supervised. Your camera stays on and photos are taken during the test. Leaving the test page is also recorded.</p>
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
          <Button className="mt-5 h-12 w-full" onClick={start}>Turn on camera and continue</Button>
        </div>
      </div>
    );
  }

  return (
    <ProctorCtx.Provider value={{ stream: streamRef.current, switches }}>
      {children}
      <video ref={videoRef} muted playsInline aria-hidden className="pointer-events-none fixed bottom-0 right-0 h-px w-px opacity-0" />
    </ProctorCtx.Provider>
  );
}

export function ProctorReview({ attemptId }: { attemptId: string }) {
  const [items, setItems] = useState<{ id: string; kind: string; created_at: string; url?: string | null | undefined }[] | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("proctor_events").select("*").eq("attempt_id", attemptId).order("created_at");
      const rows = data ?? [];
      const paths = rows.filter((r) => r.photo_path).map((r) => r.photo_path!);
      const signed = paths.length ? (await supabase.storage.from("proctor").createSignedUrls(paths, 3600)).data ?? [] : [];
      const map = new Map(signed.map((s) => [s.path, s.signedUrl]));
      setItems(rows.map((r) => ({ id: r.id, kind: r.kind, created_at: r.created_at, url: r.photo_path ? map.get(r.photo_path) : undefined })));
    })();
  }, [attemptId]);
  if (!items) return <p className="text-sm text-muted-foreground">Loading supervision record...</p>;
  const photos = items.filter((i) => i.kind === "snapshot");
  const clips = items.filter((i) => i.kind === "video" && i.url);
  const tabs = items.filter((i) => i.kind === "tab_switch").length;
  const camOff = items.filter((i) => i.kind === "camera_off").length;
  return (
    <div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1">{photos.length} photos</span>
        <span className={tabs ? "rounded-full bg-destructive/15 px-3 py-1 font-bold text-destructive" : "rounded-full bg-muted px-3 py-1"}>{tabs} tab switches</span>
        {camOff > 0 && <span className="rounded-full bg-destructive/15 px-3 py-1 font-bold text-destructive">Camera turned off {camOff}×</span>}
      </div>
      <div className="mt-3">
        <p className="mb-1 text-sm font-bold">Exam recording</p>
        {clips.length === 0 ? <p className="text-sm text-muted-foreground">No recording yet. Clips appear every 30 seconds while the student writes.</p>
          : <RecordingPlayer clips={clips.map((c) => ({ url: c.url!, at: c.created_at }))} />}
      </div>
      {photos.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No photos recorded for this attempt.</p> : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p) => (
            <a key={p.id} href={p.url ?? undefined} target="_blank" rel="noreferrer" className="block">
              {p.url && <img src={p.url} alt="Exam photo" className="aspect-[4/3] w-full rounded-lg object-cover" />}
              <p className="text-center text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleTimeString()}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Plays the 30-second clips back to back, like one continuous video. */
export function RecordingPlayer({ clips }: { clips: { url: string; at: string }[] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  const cur = clips[Math.min(i, clips.length - 1)];
  useEffect(() => { if (i > 0) void ref.current?.play().catch(() => {}); }, [i]);
  if (!cur) return null;
  return (
    <div>
      <video ref={ref} key={cur.url} src={cur.url} controls playsInline className="w-full rounded-xl bg-muted"
        onEnded={() => setI((n) => (n + 1 < clips.length ? n + 1 : n))} />
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>Part {Math.min(i, clips.length - 1) + 1} of {clips.length} · {new Date(cur.at).toLocaleTimeString()}</span>
        <span className="flex gap-2">
          <button className="font-bold text-primary disabled:opacity-40" disabled={i === 0} onClick={() => setI((n) => n - 1)}>Previous</button>
          <button className="font-bold text-primary disabled:opacity-40" disabled={i >= clips.length - 1} onClick={() => setI((n) => n + 1)}>Next</button>
        </span>
      </div>
    </div>
  );
}

/** Near-live view: refreshes the student's newest camera frame every few seconds. */
export function LiveView({ attemptId }: { attemptId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("proctor_events").select("photo_path,created_at")
        .eq("attempt_id", attemptId).in("kind", ["live", "snapshot"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!alive || !data?.photo_path) return;
      const s = await supabase.storage.from("proctor").createSignedUrl(data.photo_path, 120);
      if (alive && s.data) { setUrl(s.data.signedUrl); setAt(data.created_at); }
    };
    void load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [attemptId]);
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        {url ? <img src={url} alt="Live camera" className="h-full w-full object-cover" /> :
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Waiting for camera...</p>}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive-foreground" />LIVE
        </span>
      </div>
      {at && <p className="mt-1 text-xs text-muted-foreground">Updated {new Date(at).toLocaleTimeString()}</p>}
    </div>
  );
}

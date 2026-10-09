import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Camera, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { flushAdminEmails } from "@/lib/notify.functions";

const flush = () => { void flushAdminEmails().catch(() => {}); };

const SNAP_MS = 75_000;
const LIVE_MS = 1_000;
const CLIP_MS = 20_000;
const FLUSH_MS = 120_000;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

type ProctorState = { stream: MediaStream | null; switches: number; violation: string | null; faceMissing: number };
const ProctorCtx = createContext<ProctorState>({ stream: null, switches: 0, violation: null, faceMissing: 0 });
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

/** Rough "is anyone there" check when the browser has no built-in face detector. */
function frameLooksEmpty(v: HTMLVideoElement) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 48;
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(v, 0, 0, 64, 48);
  const d = ctx.getImageData(16, 8, 32, 32).data;
  let sum = 0, sq = 0, skin = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += y; sq += y * y;
    if (r > 60 && g > 30 && b > 15 && r > g && r > b && r - Math.min(g, b) > 12) skin++;
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
  return mean < 25 || sd < 8 || skin / n < 0.06;
}

const FACE_WARN_S = 5;
const FACE_LIMIT_S = 10;

const RULES = [
  "Your camera and microphone stay on for the whole exam. Video and sound are recorded for the examiner.",
  "Keep your face clearly inside the camera. If your face is missing for more than 10 seconds, your exam is submitted automatically.",
  "Do NOT leave this page, switch tabs, open another app or exit full screen. ONE exit submits your exam immediately.",
  "No phones, notes, books or other people. Copying, selecting or searching text is blocked.",
  "Any cheating attempt is reported to your school with the recording.",
];

/** Blocks the exam until camera + mic are on and the rules are accepted; then records and enforces the rules. */
export function Proctor({ attemptId, studentId, children }: { attemptId: string; studentId: string; children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [err, setErr] = useState("");
  const [switches, setSwitches] = useState(0);
  const [violation, setViolation] = useState<string | null>(null);
  const [faceMissing, setFaceMissing] = useState(0);
  const active = ready && agreed;

  const log = useCallback(async (kind: string, photo_path: string | null = null) => {
    await supabase.from("proctor_events").insert({ attempt_id: attemptId, student_id: studentId, kind, photo_path });
  }, [attemptId, studentId]);

  const snap = useCallback(async (kind: "snapshot" | "live" = "snapshot") => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    const w = kind === "live" ? 320 : 320;
    c.width = w; c.height = Math.round((w * v.videoHeight) / v.videoWidth);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", kind === "live" ? 0.5 : 0.6));
    if (!blob) return;
    const path = `${studentId}/${attemptId}/${kind === "live" ? "live-" : ""}${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("proctor").upload(path, blob, { contentType: "image/jpeg" });
    if (!error) await log(kind, path);
  }, [attemptId, studentId, log]);

  const start = useCallback(async () => {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640 },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = s;
      s.getVideoTracks()[0]?.addEventListener("ended", () => { setReady(false); void log("camera_off").then(flush); });
      s.getAudioTracks()[0]?.addEventListener("ended", () => { void log("mic_off").then(flush); });
      setReady(true);
    } catch {
      setErr("Camera or microphone access was blocked. Allow BOTH the camera and microphone in your browser settings, then tap the button again.");
    }
  }, [log]);

  const begin = () => {
    void document.documentElement.requestFullscreen?.().catch(() => {});
    setAgreed(true);
  };

  const fail = useCallback((kind: string, reason: string) => {
    setViolation((v) => v ?? reason);
    void log(kind).then(flush);
  }, [log]);

  useEffect(() => {
    if (ready && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [ready, agreed]);

  // Photo snapshots removed — the continuous video+audio recording is the only capture.
  void snap; void SNAP_MS; void LIVE_MS;
  useEffect(() => {
    if (!active) return;
    const f = setInterval(flush, FLUSH_MS);
    flush();
    return () => { clearInterval(f); };
  }, [active]);

  // Face tracking: count seconds with no face; auto-submit after the limit.
  useEffect(() => {
    if (!active) return;
    type FD = { detect: (v: HTMLVideoElement) => Promise<unknown[]> };
    const Ctor = (window as unknown as { FaceDetector?: new (o: object) => FD }).FaceDetector;
    let detector: FD | null = null;
    try { detector = Ctor ? new Ctor({ fastMode: true, maxDetectedFaces: 1 }) : null; } catch { detector = null; }
    let missing = 0;
    let busy = false;
    const t = setInterval(async () => {
      const v = videoRef.current;
      if (busy || !v || !v.videoWidth) return;
      busy = true;
      let none = false;
      try { none = detector ? (await detector.detect(v)).length === 0 : frameLooksEmpty(v); }
      catch { detector = null; none = frameLooksEmpty(v); }
      busy = false;
      missing = none ? missing + 1 : 0;
      setFaceMissing(missing);
      if (missing === FACE_WARN_S) void log("face_missing");
      if (missing > FACE_LIMIT_S) { clearInterval(t); fail("face_missing", "Your face was out of the camera for more than 10 seconds."); }
    }, 1000);
    return () => clearInterval(t);
  }, [active, log, fail]);

  // Continuous recording with sound, cut into short clips so each one uploads on its own.
  useEffect(() => {
    const stream = streamRef.current;
    const mime = pickMime();
    if (!active || !stream || !mime) return;
    let stopped = false;
    let rec: MediaRecorder | null = null;
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const startClip = () => {
      if (stopped) return;
      const chunks: Blob[] = [];
      const started = Date.now();
      try {
        rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 200_000, audioBitsPerSecond: 32_000 });
      } catch { return; }
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
  }, [active, attemptId, studentId, log]);

  // Zero tolerance: a single tab switch, app switch or full-screen exit submits the exam.
  useEffect(() => {
    if (!active) return;
    const exit = (msg: string) => { setSwitches((n) => n + 1); fail("tab_switch", msg); };
    const onVis = () => { if (document.visibilityState === "hidden") exit("You left the exam page."); };
    const onFs = () => { if (!document.fullscreenElement) exit("You exited full screen."); };
    const block = (e: Event) => e.preventDefault();
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "f", "p", "s", "u"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);
    for (const ev of ["contextmenu", "copy", "cut", "selectstart", "dragstart"]) document.addEventListener(ev, block);
    document.addEventListener("keydown", keys);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
      for (const ev of ["contextmenu", "copy", "cut", "selectstart", "dragstart"]) document.removeEventListener(ev, block);
      document.removeEventListener("keydown", keys);
      window.removeEventListener("beforeunload", unload);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [active, fail]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-2xl border bg-card p-6 text-center">
          <Camera className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Camera and microphone required</h1>
          <p className="mt-2 text-muted-foreground">This exam is supervised. Your camera and microphone stay on and everything is recorded with sound.</p>
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
          <Button className="mt-5 h-12 w-full" onClick={start}>Turn on camera + mic and continue</Button>
        </div>
      </div>
    );
  }

  if (!agreed) {
    return (
      <div className="exam-lock fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/80 p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border-4 border-destructive bg-card shadow-2xl">
          <div className="flex items-center gap-2 bg-destructive px-5 py-3 text-destructive-foreground">
            <ShieldAlert className="h-6 w-6" /><p className="font-display text-lg font-extrabold uppercase tracking-wide">Strict exam rules — read carefully</p>
          </div>
          <div className="p-5">
            <video ref={videoRef} muted playsInline className="mx-auto mb-4 h-32 w-44 -scale-x-100 rounded-xl object-cover" />
            <ol className="space-y-2.5">
              {RULES.map((r, i) => (
                <li key={i} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-xs font-extrabold text-destructive">{i + 1}</span><span className="font-medium">{r}</span></li>
              ))}
            </ol>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 text-sm font-bold">
              <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--destructive)]" />
              I have read and understood these rules. I accept that breaking any rule will submit my exam automatically.
            </label>
            <Button className="mt-4 h-12 w-full text-base" disabled={!ticked} onClick={begin}>I agree — start my exam</Button>
          </div>
        </div>
      </div>
    );
  }

  const left = Math.max(0, FACE_LIMIT_S - faceMissing);
  return (
    <ProctorCtx.Provider value={{ stream: streamRef.current, switches, violation, faceMissing }}>
      {faceMissing >= FACE_WARN_S && !violation && (
        <div className="fixed inset-x-0 top-0 z-[60] animate-pulse bg-destructive px-4 py-3 text-center font-extrabold text-destructive-foreground">
          FACE NOT DETECTED — return to the camera now! Auto-submit in {left}s
        </div>
      )}
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
  const face = items.filter((i) => i.kind === "face_missing").length;
  return (
    <div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1">{photos.length} photos</span>
        <span className={tabs ? "rounded-full bg-destructive/15 px-3 py-1 font-bold text-destructive" : "rounded-full bg-muted px-3 py-1"}>{tabs} tab switches</span>
        {face > 0 && <span className="rounded-full bg-destructive/15 px-3 py-1 font-bold text-destructive">Face missing {face}×</span>}
        {camOff > 0 && <span className="rounded-full bg-destructive/15 px-3 py-1 font-bold text-destructive">Camera turned off {camOff}×</span>}
      </div>
      <div className="mt-3">
        <p className="mb-1 text-sm font-bold">Exam recording</p>
        {clips.length === 0 ? <p className="text-sm text-muted-foreground">No recording yet. Clips (with sound) appear every 20 seconds while the student writes.</p>
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

/** Near-live view: checks for the student's newest recorded clip (with sound) and plays it. */
export function LiveView({ attemptId, every = 20, compact = false }: { attemptId: string; every?: number; compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let busy = false;
    let lastPath = "";
    const load = async () => {
      if (busy) return; // never stack requests, even at a 20ms interval
      busy = true;
      try {
        const { data } = await supabase.from("proctor_events").select("photo_path,created_at")
          .eq("attempt_id", attemptId).eq("kind", "video").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!alive || !data?.photo_path || data.photo_path === lastPath) return;
        const s = await supabase.storage.from("proctor").createSignedUrl(data.photo_path, 600);
        if (alive && s.data) { lastPath = data.photo_path; setUrl(s.data.signedUrl); setAt(data.created_at); }
      } finally { busy = false; }
    };
    void load();
    const t = setInterval(load, every);
    return () => { alive = false; clearInterval(t); };
  }, [attemptId, every]);
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        {url ? <video key={url} src={url} autoPlay playsInline muted={compact} controls={!compact} className="h-full w-full object-cover" /> :
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Waiting for recording...</p>}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive-foreground" />LIVE
        </span>
      </div>
      {at && !compact && <p className="mt-1 text-xs text-muted-foreground">Clip from {new Date(at).toLocaleTimeString()}</p>}
    </div>
  );
}

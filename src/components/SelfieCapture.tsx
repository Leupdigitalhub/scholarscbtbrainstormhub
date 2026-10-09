import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Live camera selfie. Calls onChange with a JPEG blob (or null when retaking). */
export function SelfieCapture({ onChange }: { onChange: (b: Blob | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [live, setLive] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setOn(false); setLive(false); };
  useEffect(() => () => stop(), []);

  // Attach the stream once the <video> exists.
  useEffect(() => {
    const v = videoRef.current;
    if (!on || !v || !streamRef.current) return;
    v.srcObject = streamRef.current;
    const ready = () => { if (v.videoWidth) setLive(true); };
    v.addEventListener("loadedmetadata", ready);
    v.addEventListener("playing", ready);
    void v.play().catch(() => {});
    const t = setInterval(ready, 200);
    return () => { clearInterval(t); v.removeEventListener("loadedmetadata", ready); v.removeEventListener("playing", ready); };
  }, [on]);

  async function open() {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia) { fileRef.current?.click(); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = s;
      setOn(true);
    } catch {
      setErr("Camera blocked. Allow the camera in your browser settings, or use 'Use phone camera' below.");
    }
  }

  function done(b: Blob) { setPhoto(URL.createObjectURL(b)); onChange(b); stop(); }

  function take() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { setErr("Camera is still starting — try again in a second."); return; }
    const size = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement("canvas");
    c.width = 320; c.height = 320;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.translate(320, 0); ctx.scale(-1, 1);
    ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, 320, 320);
    c.toBlob((b) => { if (b) done(b); }, "image/jpeg", 0.8);
  }

  function fromFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = 320; c.height = 320;
      c.getContext("2d")?.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 320, 320);
      c.toBlob((b) => { if (b) done(b); }, "image/jpeg", 0.8);
    };
    img.src = URL.createObjectURL(f);
  }

  function retake() { setPhoto(null); onChange(null); void open(); }

  return (
    <div className="rounded-xl border-2 border-dashed border-primary/40 p-3 text-center">
      <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-muted">
        {photo ? <img src={photo} alt="Your selfie" className="h-full w-full object-cover" />
          : on ? <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          : <Camera className="h-10 w-10 text-muted-foreground" />}
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={fromFile} />
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {photo ? <Button type="button" variant="outline" onClick={retake}><RotateCcw className="mr-2 h-4 w-4" />Retake</Button>
          : on ? <Button type="button" onClick={take} disabled={!live}><Camera className="mr-2 h-4 w-4" />{live ? "Take photo" : "Starting camera..."}</Button>
          : <Button type="button" variant="outline" onClick={open}><Camera className="mr-2 h-4 w-4" />Open camera</Button>}
        {!photo && <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()}>Use phone camera</Button>}
      </div>
    </div>
  );
}

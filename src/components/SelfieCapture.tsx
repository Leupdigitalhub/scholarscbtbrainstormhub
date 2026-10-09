import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Live camera selfie. Calls onChange with a JPEG blob (or null when retaking). */
export function SelfieCapture({ onChange }: { onChange: (b: Blob | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setOn(false); };
  useEffect(() => () => stop(), []);

  async function open() {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480 }, audio: false });
      streamRef.current = s;
      setOn(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = s; void videoRef.current.play().catch(() => {}); } }, 0);
    } catch {
      setErr("Camera blocked. Allow the camera in your browser settings and try again.");
    }
  }

  function take() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement("canvas");
    c.width = 320; c.height = 320;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.translate(320, 0); ctx.scale(-1, 1);
    ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, 320, 320);
    c.toBlob((b) => { if (b) { setPhoto(URL.createObjectURL(b)); onChange(b); stop(); } }, "image/jpeg", 0.8);
  }

  function retake() { setPhoto(null); onChange(null); void open(); }

  return (
    <div className="rounded-xl border-2 border-dashed border-primary/40 p-3 text-center">
      <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-muted">
        {photo ? <img src={photo} alt="Your selfie" className="h-full w-full object-cover" />
          : on ? <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          : <Camera className="h-10 w-10 text-muted-foreground" />}
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <div className="mt-3">
        {photo ? <Button type="button" variant="outline" onClick={retake}><RotateCcw className="mr-2 h-4 w-4" />Retake</Button>
          : on ? <Button type="button" onClick={take}><Camera className="mr-2 h-4 w-4" />Take photo</Button>
          : <Button type="button" variant="outline" onClick={open}><Camera className="mr-2 h-4 w-4" />Open camera</Button>}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { explainMistakes } from "@/lib/ai-tutor.functions";

function render(text: string) {
  return text.split("\n").map((line, i) => {
    const bold = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p));
    if (/^#{1,6}\s/.test(line)) return <p key={i} className="mt-4 font-bold text-primary">{line.replace(/^#+\s/, "").replace(/\*\*/g, "")}</p>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm leading-relaxed">{bold}</p>;
  });
}

export function AiTutor({ attemptId }: { attemptId: string }) {
  const run = useServerFn(explainMistakes);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="mt-6 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-bold"><Sparkles className="h-5 w-5 text-primary" />AI Tutor</p>
          <p className="text-sm text-muted-foreground">Get step-by-step explanations for the questions you missed, plus study tips.</p>
        </div>
        {!text && (
          <Button disabled={busy} onClick={async () => {
            setBusy(true); setErr("");
            try {
              const r = await run({ data: { attemptId } });
              if (r.ok) setText(r.text); else setErr(r.message);
            } catch { setErr("Could not reach the AI tutor. Check your connection and try again."); }
            setBusy(false);
          }}>{busy ? "Thinking... (up to a minute)" : "Explain my mistakes"}</Button>
        )}
      </div>
      {err && <p className="mt-3 text-sm font-bold text-destructive">{err}</p>}
      {text && <div className="mt-3 rounded-xl bg-card p-4">{render(text)}</div>}
    </div>
  );
}

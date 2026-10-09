import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { Button } from "@/components/ui/button";
import { BANK_SUBJECTS, MASTER_BANK } from "@/lib/master-bank";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice — SCHOLARS CBT" }, { name: "description", content: "Practice questions with instant explanations." }] }),
  component: Practice,
});

const L = ["A", "B", "C", "D"] as const;

function Practice() {
  const [sub, setSub] = useState<string>(BANK_SUBJECTS[0] ?? "English");
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, seen: 0 });
  const rows = MASTER_BANK[sub] ?? [];
  const [q, opts, ans, why] = rows[i % rows.length]!;

  function choose(l: string) {
    if (pick) return;
    setPick(l);
    setScore((s) => ({ right: s.right + (l === ans ? 1 : 0), seen: s.seen + 1 }));
  }
  function next() { setPick(null); setI((n) => (n + 1) % rows.length); }
  function switchSub(s: string) { setSub(s); setI(0); setPick(null); setScore({ right: 0, seen: 0 }); }

  return (
    <StudentShell>
      <h1 className="text-3xl font-extrabold">Practice</h1>
      <p className="mt-1 text-muted-foreground">Answer at your own pace. You see the correct answer and explanation straight away.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {BANK_SUBJECTS.map((s) => (
          <button key={s} onClick={() => switchSub(s)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", s === sub ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{s}</button>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex justify-between text-sm font-bold text-muted-foreground">
          <span>Question {(i % rows.length) + 1} of {rows.length}</span>
          <span>Score: {score.right}/{score.seen}</span>
        </div>
        <p className="mt-4 text-lg font-bold">{q}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {opts.map((o: string, k: number) => {
            const l = L[k] as string;
            const state = !pick ? "" : l === ans ? "border-success bg-success/10" : l === pick ? "border-destructive bg-destructive/10" : "opacity-60";
            return (
              <button key={l} onClick={() => choose(l)} className={cn("flex items-center gap-3 rounded-xl border-2 p-4 text-left transition hover:border-primary", state)}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted font-bold">{l}</span>{o}
              </button>
            );
          })}
        </div>
        {pick && (
          <div className="mt-5 rounded-xl bg-muted p-4">
            <p className="flex items-center gap-2 font-bold">{pick === ans ? <><CheckCircle2 className="h-5 w-5 text-success" />Correct!</> : <><XCircle className="h-5 w-5 text-destructive" />The answer is {ans}</>}</p>
            <p className="mt-2 text-sm">{why}</p>
            <Button className="mt-4" onClick={next}>Next question</Button>
          </div>
        )}
      </div>
    </StudentShell>
  );
}

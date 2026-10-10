import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BANK_SUBJECTS, MASTER_BANK } from "@/lib/master-bank";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice — SCHOLARS CBT" }, { name: "description", content: "Pick a subject, number of questions and time, then practise shuffled questions." }] }),
  component: Practice,
});

const L = ["A", "B", "C", "D"] as const;
type Row = [string, string[], string, string];
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; } return b; };

function Practice() {
  const [sub, setSub] = useState<string>(BANK_SUBJECTS[0] ?? "English");
  const [count, setCount] = useState(10);
  const [mins, setMins] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!rows || done || !mins) return;
    const t = setInterval(() => setLeft((l) => { if (l <= 1) { setDone(true); return 0; } return l - 1; }), 1000);
    return () => clearInterval(t);
  }, [rows, done, mins]);

  function start() {
    const pool = shuffle((MASTER_BANK[sub] ?? []) as Row[]).slice(0, Math.max(1, count));
    setRows(pool); setI(0); setPick(null); setRight(0); setDone(false); setLeft(mins * 60);
  }
  const avail = (MASTER_BANK[sub] ?? []).length;

  if (!rows) return (
    <StudentShell>
      <h1 className="text-3xl font-extrabold">Practice</h1>
      <p className="mt-1 text-muted-foreground">Choose a subject, how many questions and how much time. Questions are shuffled every time.</p>
      <div className="mt-5 rounded-2xl border bg-card p-6 space-y-5">
        <div><p className="font-bold">Subject</p><div className="mt-2 flex flex-wrap gap-2">
          {BANK_SUBJECTS.map((s) => <button key={s} onClick={() => setSub(s)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", s === sub ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{s}</button>)}
        </div></div>
        <div><p className="font-bold">Number of questions <span className="text-sm font-normal text-muted-foreground">({avail} available)</span></p><div className="mt-2 flex flex-wrap items-center gap-2">
          {[10, 20, 40, 60].map((n) => <button key={n} onClick={() => setCount(n)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", count === n ? "bg-primary text-primary-foreground" : "bg-card")}>{n}</button>)}
          <Input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className="w-24" />
        </div></div>
        <div><p className="font-bold">Time</p><div className="mt-2 flex flex-wrap gap-2">
          {[0, 10, 20, 30, 60].map((n) => <button key={n} onClick={() => setMins(n)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", mins === n ? "bg-primary text-primary-foreground" : "bg-card")}>{n ? `${n} min` : "No timer"}</button>)}
        </div></div>
        <Button className="h-12 w-full text-lg" onClick={start} disabled={!avail}>Start practice</Button>
      </div>
    </StudentShell>
  );

  const total = rows.length;
  if (done || i >= total) return (
    <StudentShell>
      <div className="rounded-2xl border bg-card p-8 text-center">
        <h1 className="text-3xl font-extrabold">Practice finished</h1>
        <p className="mt-3 text-5xl font-extrabold text-primary">{right}/{total}</p>
        <p className="mt-1 text-muted-foreground">{Math.round((right / total) * 100)}%</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2"><Button onClick={start}>Practise again</Button><Button variant="outline" onClick={() => setRows(null)}>Choose another subject</Button></div>
      </div>
    </StudentShell>
  );

  const [q, opts, ans, why] = rows[i]!;
  const choose = (l: string) => { if (pick) return; setPick(l); if (l === ans) setRight((r) => r + 1); };
  return (
    <StudentShell>
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex justify-between text-sm font-bold text-muted-foreground">
          <span>{sub} · Question {i + 1} of {total}</span>
          {mins > 0 && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
          <span>Score: {right}</span>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-lg font-bold">{q}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {opts.map((o, k) => {
            const l = L[k] as string;
            const state = !pick ? "" : l === ans ? "border-success bg-success/10" : l === pick ? "border-destructive bg-destructive/10" : "opacity-60";
            return <button key={l} onClick={() => choose(l)} className={cn("flex items-center gap-3 rounded-xl border-2 p-4 text-left transition hover:border-primary", state)}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted font-bold">{l}</span>{o}</button>;
          })}
        </div>
        {pick && (
          <div className="mt-5 rounded-xl bg-muted p-4">
            <p className="flex items-center gap-2 font-bold">{pick === ans ? <><CheckCircle2 className="h-5 w-5 text-success" />Correct!</> : <><XCircle className="h-5 w-5 text-destructive" />The answer is {ans}</>}</p>
            <p className="mt-2 text-sm">{why}</p>
            <Button className="mt-4" onClick={() => { setPick(null); setI(i + 1); }}>{i + 1 < total ? "Next question" : "See my score"}</Button>
          </div>
        )}
        <Button variant="ghost" className="mt-4" onClick={() => setDone(true)}>End practice</Button>
      </div>
    </StudentShell>
  );
}

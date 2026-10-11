import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSubjects } from "@/lib/subjects";
import { splitPassage, passageKind } from "@/lib/passage";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice — SCHOLARS CBT" }, { name: "description", content: "Pick one or more subjects, number of questions and time, then practise shuffled questions from the question bank." }] }),
  component: Practice,
});

type Q = { id: string; subject: string; text: string; options: string[]; correct_answer: string; explanation: string };
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; } return b; };

function Practice() {
  const bank = useQuery({
    queryKey: ["practice-bank-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("bank_questions").select("subject").eq("type", "mcq").limit(20000);
      const m = new Map<string, number>();
      for (const r of data ?? []) m.set(r.subject, (m.get(r.subject) ?? 0) + 1);
      return m;
    },
  });
  const [subs, setSubs] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [mins, setMins] = useState(0);
  const [rows, setRows] = useState<Q[] | null>(null);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!rows || done || !mins) return;
    const t = setInterval(() => setLeft((l) => { if (l <= 1) { setDone(true); return 0; } return l - 1; }), 1000);
    return () => clearInterval(t);
  }, [rows, done, mins]);

  async function start() {
    setBusy(true);
    const all: Q[] = [];
    for (const s of subs) {
      const { data } = await supabase.from("bank_questions").select("id,subject,text,options,correct_answer,explanation").eq("subject", s).eq("type", "mcq").limit(5000);
      all.push(...shuffle((data ?? []) as unknown as Q[]).slice(0, Math.max(1, count)));
    }
    setBusy(false);
    setRows(all); setI(0); setPick(null); setRight(0); setDone(false); setLeft(mins * 60);
  }
  const allSubs = useSubjects();
  const counts: [string, number][] = allSubs.map((s) => [s, bank.data?.get(s) ?? 0]);
  const toggle = (s: string) => setSubs((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  if (!rows) return (
    <StudentShell>
      <h1 className="text-3xl font-extrabold">Practice</h1>
      <p className="mt-1 text-muted-foreground">Pick one or more subjects, how many questions per subject and how much time. Questions come from your school's question bank and are shuffled every time.</p>
      <div className="mt-5 space-y-5 rounded-2xl border bg-card p-6">
        <div><p className="font-bold">Subjects</p><div className="mt-2 flex flex-wrap gap-2">
          {bank.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!bank.isLoading && !counts.length && <p className="text-sm text-muted-foreground">No questions in the bank yet.</p>}
          {counts.map(([s, n]) => <button key={s} onClick={() => toggle(s)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", subs.includes(s) ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{s} <span className="opacity-70">({n})</span></button>)}
        </div></div>
        <div><p className="font-bold">Questions per subject</p><div className="mt-2 flex flex-wrap items-center gap-2">
          {[10, 20, 40, 60].map((n) => <button key={n} onClick={() => setCount(n)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", count === n ? "bg-primary text-primary-foreground" : "bg-card")}>{n}</button>)}
          <Input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className="w-24" />
        </div></div>
        <div><p className="font-bold">Time</p><div className="mt-2 flex flex-wrap gap-2">
          {[0, 10, 20, 30, 60, 120].map((n) => <button key={n} onClick={() => setMins(n)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", mins === n ? "bg-primary text-primary-foreground" : "bg-card")}>{n ? `${n} min` : "No timer"}</button>)}
        </div></div>
        <Button className="h-12 w-full text-lg" onClick={start} disabled={!subs.length || busy}>{busy ? "Loading..." : "Start practice"}</Button>
      </div>
    </StudentShell>
  );

  const total = rows.length;
  if (done || i >= total) return (
    <StudentShell>
      <div className="rounded-2xl border bg-card p-8 text-center">
        <h1 className="text-3xl font-extrabold">Practice finished</h1>
        <p className="mt-3 text-5xl font-extrabold text-primary">{right}/{total}</p>
        <p className="mt-1 text-muted-foreground">{total ? Math.round((right / total) * 100) : 0}%</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2"><Button onClick={start}>Practise again</Button><Button variant="outline" onClick={() => setRows(null)}>Choose other subjects</Button></div>
      </div>
    </StudentShell>
  );

  const q = rows[i]!;
  const opts = Array.isArray(q.options) ? q.options : [];
  const ans = q.correct_answer.trim().toUpperCase();
  const choose = (l: string) => { if (pick) return; setPick(l); if (l === ans) setRight((r) => r + 1); };
  return (
    <StudentShell>
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex justify-between text-sm font-bold text-muted-foreground">
          <span>{q.subject} · Question {i + 1} of {total}</span>
          {mins > 0 && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
          <span>Score: {right}</span>
        </div>
        {(() => { const sp = splitPassage(q.text); return (<>
          {sp.passage && (
            <details open className="mt-4 rounded-xl border-2 border-primary/30 bg-muted/40 p-3">
              <summary className="cursor-pointer text-sm font-extrabold text-primary">📖 Read the {passageKind(sp.passage.title).toLowerCase()}{sp.passage.title ? ` — ${sp.passage.title}` : ""}</summary>
              <div className="mt-2 max-h-[45vh] overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-relaxed">{sp.passage.body}</div>
            </details>
          )}
          <p className="mt-4 whitespace-pre-wrap text-lg font-bold">{sp.question}</p>
        </>); })()}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {opts.map((o, k) => {
            const l = String.fromCharCode(65 + k);
            const state = !pick ? "" : l === ans ? "border-success bg-success/10" : l === pick ? "border-destructive bg-destructive/10" : "opacity-60";
            return <button key={l} onClick={() => choose(l)} className={cn("flex items-center gap-3 rounded-xl border-2 p-4 text-left transition hover:border-primary", state)}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted font-bold">{l}</span>{o}</button>;
          })}
        </div>
        {pick && (
          <div className="mt-5 rounded-xl bg-muted p-4">
            <p className="flex items-center gap-2 font-bold">{pick === ans ? <><CheckCircle2 className="h-5 w-5 text-success" />Correct!</> : <><XCircle className="h-5 w-5 text-destructive" />The answer is {ans}</>}</p>
            {q.explanation && <p className="mt-2 text-sm">{q.explanation}</p>}
            <Button className="mt-4" onClick={() => { setPick(null); setI(i + 1); }}>{i + 1 < total ? "Next question" : "See my score"}</Button>
          </div>
        )}
        <Button variant="ghost" className="mt-4" onClick={() => setDone(true)}>End practice</Button>
      </div>
    </StudentShell>
  );
}

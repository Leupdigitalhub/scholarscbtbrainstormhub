import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Check, Flag, Eraser } from "lucide-react";
import { useMe } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Proctor, CameraMonitor, useProctor } from "@/components/Proctor";
import { GiftCard } from "@/components/GiftCard";
import { Calculator } from "@/components/Calculator";
import { flushAdminEmails } from "@/lib/notify.functions";

export const Route = createFileRoute("/_authenticated/attempt/$attemptId")({
  head: () => ({ meta: [{ title: "Taking Test — SCHOLARS CBT" }] }),
  component: Attempt,
});

type Opt = { text: string; value: string };
type Q = { id: string; type: "mcq" | "true_false" | "short" | "written"; text: string; options: Opt[]; marks: number; subject?: string };
type AttemptData = {
  id: string; status: string; deadline: string; server_now: string; answers: Record<string, string>;
  test: { title: string; subject: string }; questions: Q[];
};

function Attempt() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_attempt", { _attempt_id: attemptId });
      if (error) throw error;
      return data as unknown as AttemptData;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data && data.status !== "in_progress") navigate({ to: "/result/$attemptId", params: { attemptId }, replace: true });
  }, [data, attemptId, navigate]);

  if (isLoading) return <div className="p-8 text-center">Loading test...</div>;
  if (error || !data) return <div className="p-8 text-center">Could not load this test.</div>;
  if (data.status !== "in_progress") return null;
  return <ProctoredRunner data={data} />;
}

function ProctoredRunner({ data }: { data: AttemptData }) {
  const { data: me } = useMe();
  if (!me) return <div className="p-8 text-center">Loading test...</div>;
  return <Proctor attemptId={data.id} studentId={me.user.id}><GiftCard attemptId={data.id}><Runner data={data} /></GiftCard></Proctor>;
}

function Runner({ data }: { data: AttemptData }) {
  const navigate = useNavigate();
  const storageKey = `attempt-${data.id}`;
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      const local = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return { ...data.answers, ...local };
    } catch { return data.answers; }
  });
  const { data: me } = useMe();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setFlags(JSON.parse(localStorage.getItem(storageKey + "-flags") || "{}")); } catch { /* ignore */ } }, [storageKey]);
  useEffect(() => { localStorage.setItem(storageKey + "-flags", JSON.stringify(flags)); }, [flags, storageKey]);
  const [idx, setIdx] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(true);
  const submitting = useRef(false);
  const offset = useRef(new Date(data.server_now).getTime() - Date.now());
  const deadline = new Date(data.deadline).getTime();
  const [left, setLeft] = useState(() => Math.max(0, deadline - (Date.now() + offset.current)));
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const submit = useCallback(async (auto = false) => {
    if (submitting.current) return;
    submitting.current = true;
    const { error } = await supabase.rpc("submit_attempt", { _attempt_id: data.id, _answers: answersRef.current });
    if (error) { submitting.current = false; { toast.error("Could not submit. Check your internet and try again."); return; } }
    void flushAdminEmails().catch(() => {});
    localStorage.removeItem(storageKey);
    localStorage.removeItem(storageKey + "-flags");
    if (auto) toast.info("Time is up! Your test was submitted.");
    navigate({ to: "/result/$attemptId", params: { attemptId: data.id }, replace: true });
  }, [data.id, navigate, storageKey]);

  // timer
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, deadline - (Date.now() + offset.current));
      setLeft(l);
      if (l <= 0) { clearInterval(t); submit(true); }
    }, 500);
    return () => clearInterval(t);
  }, [deadline, submit]);

  // auto-submit after too many tab switches / full-screen exits
  const { switches } = useProctor();
  useEffect(() => {
    if (switches === 3) toast.error("Warning: 2 more exits and your test will be submitted automatically.");
    if (switches >= 5) { toast.error("Too many exits. Your test was submitted."); void submit(false); }
  }, [switches, submit]);

  // autosave
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(answers));
    setSaved(false);
    const t = setTimeout(async () => {
      const { error } = await supabase.rpc("save_answers", { _attempt_id: data.id, _answers: answers });
      if (!error) setSaved(true);
    }, 800);
    return () => clearTimeout(t);
  }, [answers, data.id, storageKey]);

  const qs = data.questions;
  const q = qs[idx];
  const answered = qs.filter((x) => (answers[x.id] ?? "").trim() !== "").length;
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  const setA = (v: string) => setAnswers((a) => ({ ...a, [q!.id]: v }));
  const opts = q?.options ?? [];
  const subjects = [...new Set(qs.map((x) => x.subject ?? "").filter(Boolean))];

  const name = me?.profile?.full_name || "Candidate";
  const flaggedCount = qs.filter((x) => flags[x.id]).length;
  const timeTone = left < 60000 ? "bg-destructive text-destructive-foreground animate-pulse" : left < 300000 ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground";

  const palette = (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold uppercase tracking-wide">Question Palette</p>
        <p className="text-xs font-bold text-muted-foreground">{answered}/{qs.length}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-success transition-all" style={{ width: `${qs.length ? (answered / qs.length) * 100 : 0}%` }} /></div>
      {subjects.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {subjects.map((n) => (
            <button key={n} onClick={() => setIdx(qs.findIndex((x) => x.subject === n))}
              className={cn("rounded-full px-2.5 py-1 text-xs font-bold", q?.subject === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}>
              {n} {qs.filter((x) => x.subject === n && (answers[x.id] ?? "").trim()).length}/{qs.filter((x) => x.subject === n).length}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-10 gap-1 sm:grid-cols-10 lg:grid-cols-6">
        {qs.map((x, i) => (subjects.length > 1 && x.subject !== q?.subject) ? null : (
          <button key={x.id} onClick={() => setIdx(i)} aria-label={`Question ${i + 1}`}
            className={cn("aspect-square rounded-md border text-[11px] font-bold transition sm:text-xs",
              i === idx ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30" : flags[x.id] ? "border-warning bg-warning text-warning-foreground" : (answers[x.id] ?? "").trim() ? "border-success bg-success text-success-foreground" : "border-border bg-muted text-muted-foreground hover:border-primary/50")}>
            {i + 1}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
        <Legend c="bg-muted border" l="Not answered" /><Legend c="bg-success" l="Answered" /><Legend c="bg-warning" l="Flagged" /><Legend c="bg-primary" l="Current" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen select-none pb-6 [-webkit-touch-callout:none]">
      <Calculator />
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent font-display text-lg font-extrabold text-accent-foreground">{name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{[me?.profile?.class, me?.profile?.student_id].filter(Boolean).join(" · ") || "Candidate"} · {data.test.title}</p>
              <p className="text-[11px] font-bold text-muted-foreground">{saved ? "✓ All answers saved" : "Saving..."}</p>
            </div>
          </div>
          <div className={cn("flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xl font-bold tabular-nums shadow-sm", timeTone)}>
            <Clock className="h-5 w-5" /><span className="hidden text-[10px] font-sans tracking-widest sm:inline">TIME LEFT</span>{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[260px_1fr_260px]">
        <aside className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">{palette}</aside>

        <main className="order-1 min-w-0 lg:order-2">
          {q ? (
            <div className="rounded-2xl border bg-card p-3.5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="rounded-full bg-primary/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-primary">{q.subject ? `${q.subject} · ` : ""}Question {idx + 1} of {qs.length}</p>
                <p className="text-xs font-bold text-muted-foreground">{q.marks} mark{Number(q.marks) === 1 ? "" : "s"}</p>
              </div>
              <h2 className="mt-3 whitespace-pre-wrap font-sans text-base font-bold leading-snug tracking-normal sm:text-xl">{q.text}</h2>
              <div className={cn("mt-4 grid gap-2", (q.type === "mcq" || q.type === "true_false") && "sm:grid-cols-2")}>
                {(q.type === "mcq" || q.type === "true_false") && opts.map((o, i) => {
                  const sel = answers[q.id] === o.value;
                  return (
                    <button key={o.value} onClick={() => setA(o.value)}
                      className={cn("group flex min-h-11 w-full items-center gap-2.5 rounded-xl border-2 px-2.5 py-2 text-left text-sm font-medium transition sm:min-h-14 sm:gap-3 sm:p-3 sm:text-base",
                        sel ? "border-primary bg-primary/10 shadow-md" : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:shadow")}>
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 font-display text-sm font-extrabold sm:h-9 sm:w-9 sm:text-base",
                        sel ? "border-primary bg-primary text-primary-foreground" : "border-input bg-muted group-hover:border-primary/50")}>
                        {sel ? <Check className="h-4 w-4" /> : q.type === "mcq" ? String.fromCharCode(65 + i) : i === 0 ? "T" : "F"}
                      </span>
                      <span>{o.text}</span>
                    </button>
                  );
                })}
                {q.type === "short" && <Input value={answers[q.id] ?? ""} onChange={(e) => setA(e.target.value)} placeholder="Type your answer" className="h-14 text-lg" />}
                {q.type === "written" && <Textarea value={answers[q.id] ?? ""} onChange={(e) => setA(e.target.value)} placeholder="Write your answer" rows={8} className="text-base" />}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant={flags[q.id] ? "default" : "outline"} size="sm" onClick={() => setFlags((f) => ({ ...f, [q.id]: !f[q.id] }))}>
                  <Flag className="mr-1 h-4 w-4" />{flags[q.id] ? "Flagged" : "Flag for review"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAnswers((a) => { const n = { ...a }; delete n[q.id]; return n; })}>
                  <Eraser className="mr-1 h-4 w-4" />Clear Answer
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t pt-5">
                <Button variant="outline" className="h-12 min-w-[30%] flex-1" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Previous</Button>
                {idx < qs.length - 1 && <Button className="h-12 flex-1" onClick={() => setIdx(idx + 1)}>Next →</Button>}
                <Button className="h-12 flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => setConfirm(true)}>Submit Exam</Button>
              </div>
            </div>
          ) : <p>This test has no questions.</p>}
        </main>

        <aside className="order-first space-y-3 lg:order-3 lg:sticky lg:top-24 lg:self-start">
          <CameraMonitor className="mx-auto max-w-[160px] lg:max-w-none" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat n={answered} l="Done" c="bg-success/15" />
            <MiniStat n={qs.length - answered} l="Left" c="bg-destructive/10" />
            <MiniStat n={flaggedCount} l="Flagged" c="bg-warning/25" />
          </div>
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Keep your face in view. Do not switch tabs — every switch is reported to your supervisor.</p>
        </aside>
      </div>


      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your test?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit your test? You will not be able to change your answers after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-success/15 p-3"><p className="text-2xl font-bold">{answered}</p><p className="text-sm">Answered</p></div>
            <div className="rounded-xl bg-destructive/10 p-3"><p className="text-2xl font-bold">{qs.length - answered}</p><p className="text-sm">Unanswered</p></div>
            <div className="rounded-xl bg-warning/25 p-3"><p className="text-2xl font-bold">{flaggedCount}</p><p className="text-sm">Flagged</p></div>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" className="h-12" onClick={() => setConfirm(false)}>Return to Test</Button>
            <Button className="h-12" onClick={() => submit(false)}>Submit Test</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MiniStat({ n, l, c }: { n: number; l: string; c: string }) {
  return <div className={cn("rounded-xl p-2", c)}><p className="text-lg font-bold">{n}</p><p className="text-[11px]">{l}</p></div>;
}

function Legend({ c, l }: { c: string; l: string }) {
  return <span className="flex items-center gap-1"><span className={cn("h-3 w-3 rounded", c)} />{l}</span>;
}

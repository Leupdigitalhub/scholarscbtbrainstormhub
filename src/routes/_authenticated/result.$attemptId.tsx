import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Download, MinusCircle, XCircle, BookOpenCheck } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { gradeFor, pct, useMe, useSettings } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Corrections, type CorrectionRow, isRight } from "@/components/Corrections";

export const Route = createFileRoute("/_authenticated/result/$attemptId")({
  head: () => ({ meta: [{ title: "My Result Slip — SCHOLARS CBT" }, { name: "description", content: "Your SCHOLARS CBT result slip with score, grade and subject performance." }] }),
  component: Result,
});

function Gauge({ value, tone }: { value: number; tone: string }) {
  const r = 70, c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" strokeWidth="14" className="stroke-muted" />
        <circle cx="80" cy="80" r={r} fill="none" strokeWidth="14" strokeLinecap="round" className={cn("transition-all duration-1000", tone)}
          strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-extrabold sm:text-3xl">{value}%</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Score</span>
      </div>
    </div>
  );
}

function Result() {
  const { attemptId } = Route.useParams();
  const { data: me } = useMe();
  const { data: settings } = useSettings();
  const [showCorr, setShowCorr] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["my-results"],
    queryFn: async () => (await supabase.rpc("my_results")).data ?? [],
  });
  const corr = useQuery({
    queryKey: ["my-corrections", attemptId],
    queryFn: async () => ((await supabase.rpc("my_corrections", { _attempt_id: attemptId })).data ?? null) as CorrectionRow[] | null,
  });
  const r = data?.find((x) => x.attempt_id === attemptId);
  if (isLoading) return <StudentShell><p>Loading...</p></StudentShell>;
  if (!r) return <StudentShell><p>Result not found.</p></StudentShell>;
  const p = pct(r.score, r.total);
  const passed = p >= r.pass_percentage;
  const grade = gradeFor(p, settings?.grade_scale);
  const rows = corr.data ?? [];
  const bySubject = new Map<string, { right: number; total: number }>();
  for (const q of rows) {
    const k = q.subject || "General";
    const s = bySubject.get(k) ?? { right: 0, total: 0 };
    s.total++; if (isRight(q) === true) s.right++;
    bySubject.set(k, s);
  }
  const tone = r.pending_grading ? "stroke-muted-foreground" : passed ? "stroke-success" : "stroke-destructive";

  return (
    <StudentShell>
      <div id="result-slip" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between bg-primary px-6 py-3 text-primary-foreground">
          <span className="font-display font-extrabold tracking-wide">SCHOLARS CBT · RESULT SLIP</span>
          <span className="text-xs font-bold">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString([], { dateStyle: "medium" }) : ""}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-4 sm:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Candidate</p>
            <h1 className="mt-0.5 text-lg font-extrabold sm:text-xl">{me?.profile?.full_name}</h1>
            <p className="text-sm text-muted-foreground">{[me?.profile?.class && `Class ${me.profile.class}`, me?.profile?.student_id && `Reg ${me.profile.student_id}`].filter(Boolean).join(" · ")}</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Examination</p>
            <p className="text-sm font-bold sm:text-base">{r.test_title}</p>
            {r.show_results && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="font-display text-xl font-extrabold">{r.score}<span className="text-sm text-muted-foreground">/{r.total}</span></span>
                <span className="rounded-md bg-accent px-2 py-0.5 font-display text-sm font-extrabold text-accent-foreground">Grade {grade}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-extrabold",
                  r.pending_grading ? "bg-muted" : passed ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground")}>
                  {r.pending_grading ? "AWAITING MARKING" : passed ? "PASSED" : "FAILED"}
                </span>
              </div>
            )}
          </div>
          {r.show_results && <Gauge value={p} tone={tone} />}
        </div>

        {!r.show_results ? (
          <p className="mx-6 mb-6 rounded-xl bg-muted p-5 text-center">Your test has been submitted. Your teacher will release the results soon.</p>
        ) : (
          <div className="space-y-3 px-4 pb-4 sm:px-5">
            <div className="grid grid-cols-3 gap-2">
              <Chip icon={CheckCircle2} n={r.correct_count} l="Correct" c="bg-success/15 text-success" />
              <Chip icon={XCircle} n={r.wrong_count} l="Wrong" c="bg-destructive/10 text-destructive" />
              <Chip icon={MinusCircle} n={r.unanswered_count} l="Unattempted" c="bg-muted text-muted-foreground" />
            </div>
            {bySubject.size > 0 && (
              <div>
                <p className="mb-2 text-sm font-extrabold uppercase tracking-wide">Subject Performance</p>
                <div className="space-y-1.5">
                  {[...bySubject.entries()].map(([s, v]) => {
                    const sp = Math.round((v.right / Math.max(1, v.total)) * 100);
                    return (
                      <div key={s}>
                        <div className="flex justify-between text-sm"><span className="font-bold">{s}</span><span className="text-muted-foreground">{v.right}/{v.total} · {sp}%</span></div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", sp >= r.pass_percentage ? "bg-success" : sp >= 40 ? "bg-warning" : "bg-destructive")} style={{ width: `${sp}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {r.pending_grading && <p className="text-sm text-muted-foreground">Some written answers will be marked by your teacher.</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t bg-muted/40 px-4 py-3 print:hidden">
          <Button onClick={() => window.print()}><Download className="mr-2 h-4 w-4" />Download Result Slip</Button>
          {rows.length > 0 && (
            <Button variant="outline" onClick={() => setShowCorr((v) => !v)}><BookOpenCheck className="mr-2 h-4 w-4" />{showCorr ? "Hide" : "View"} Corrections & Explanations</Button>
          )}
          <Button asChild variant="ghost"><Link to="/dashboard">Back to Dashboard</Link></Button>
        </div>
      </div>
      {showCorr && <div className="print:hidden"><Corrections attemptId={attemptId} /></div>}
    </StudentShell>
  );
}

function Chip({ icon: Icon, n, l, c }: { icon: typeof CheckCircle2; n: number | null; l: string; c: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl p-2 sm:p-2.5", c)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div><p className="text-base font-extrabold leading-none text-foreground">{n ?? 0}</p><p className="text-[10px] font-bold">{l}</p></div>
    </div>
  );
}

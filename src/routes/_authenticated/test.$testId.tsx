import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { StudentShell } from "@/components/StudentShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/test/$testId")({
  head: () => ({ meta: [{ title: "Test Instructions — SCHOLARS CBT" }] }),
  component: Instructions,
});

function Instructions() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["student-tests"],
    queryFn: async () => (await supabase.rpc("student_tests")).data ?? [],
  });
  const t = data?.find((x) => x.id === testId);
  const cfg = useQuery({
    queryKey: ["test-subjects", testId],
    queryFn: async () => (await supabase.rpc("test_subject_config", { _test_id: testId })).data as unknown as
      { multi_subject: boolean; per_subject_count: number; compulsory: string[]; electives: string[]; pick: number } | null,
  });
  const [picked, setPicked] = useState<string[]>([]);
  const multi = cfg.data?.multi_subject ?? false;
  const pick = cfg.data?.pick ?? 2;
  const toggle = (n: string) => setPicked((p) => p.includes(n) ? p.filter((x) => x !== n) : p.length >= pick ? p : [...p, n]);

  async function start() {
    setBusy(true);
    const { data: id, error } = multi
      ? await supabase.rpc("start_attempt_subjects", { _test_id: testId, _subjects: picked })
      : await supabase.rpc("start_attempt", { _test_id: testId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/attempt/$attemptId", params: { attemptId: id as string } });
  }

  if (isLoading) return <StudentShell><p>Loading...</p></StudentShell>;
  const now = Date.now();
  if (t && t.start_at && new Date(t.start_at).getTime() > now) return <StudentShell><div className="rounded-2xl border bg-card p-6 text-center"><h1 className="text-2xl font-bold">Test Not Yet Available</h1><p className="mt-2 text-muted-foreground">Opens {new Date(t.start_at).toLocaleString()}</p></div></StudentShell>;
  if (t && t.end_at && new Date(t.end_at).getTime() < now) return <StudentShell><div className="rounded-2xl border bg-card p-6 text-center"><h1 className="text-2xl font-bold">Test Closed</h1></div></StudentShell>;
  if (!t) return <StudentShell><p>This test is not available.</p><Link to="/dashboard" className="text-primary">Back</Link></StudentShell>;
  return (
    <StudentShell>
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.subject}</p>
        <h1 className="mt-1 text-3xl font-extrabold">{t.title}</h1>
        <p className="mt-4 rounded-xl bg-accent p-4 text-lg font-bold text-accent-foreground">
          You have {t.duration_minutes} minutes to answer {t.question_count} questions.
        </p>
        {t.instructions && <p className="mt-5 whitespace-pre-wrap">{t.instructions}</p>}
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>The timer starts when you press Start CBT and cannot be paused.</li>
          <li>Your answers are saved automatically.</li>
          <li>When time runs out your test is submitted automatically.</li>
          <li>You can flag questions to review before submitting.</li>
          <li>You cannot change answers after submitting.</li>
        </ul>
        {multi && cfg.data && (
          <div className="mt-6 rounded-2xl border bg-muted/40 p-4">
            <p className="font-bold">Choose your subjects</p>
            <p className="text-sm text-muted-foreground">{cfg.data.compulsory.join(", ")} (compulsory): {cfg.data.per_subject_count + 10} questions. Pick exactly {pick} more: {cfg.data.per_subject_count} questions each. Total: {cfg.data.per_subject_count * (cfg.data.compulsory.length + pick) + 10 * cfg.data.compulsory.length} questions.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {cfg.data.compulsory.map((n) => (
                <div key={n} className="flex items-center justify-between rounded-xl border-2 border-success bg-success/10 p-3 font-bold">
                  {n}<span className="rounded-full bg-success px-2 py-0.5 text-xs text-success-foreground">Compulsory</span>
                </div>
              ))}
              {cfg.data.electives.map((n) => {
                const on = picked.includes(n);
                return (
                  <button key={n} type="button" onClick={() => toggle(n)}
                    className={`flex items-center justify-between rounded-xl border-2 p-3 text-left font-bold ${on ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                    {n}{on && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Selected</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm">{picked.length} of {pick} chosen</p>
          </div>
        )}
        <Button onClick={start} disabled={busy || (multi && picked.length !== pick)} className="mt-6 h-14 w-full text-lg">{busy ? "Starting..." : "Start CBT"}</Button>
      </div>
    </StudentShell>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAdminResults } from "@/lib/admin-data";
import { cn } from "@/lib/utils";
import { ProctorReview } from "@/components/Proctor";

export const Route = createFileRoute("/_authenticated/admin/results/$attemptId")({
  component: ResultDetail,
});

function ResultDetail() {
  const { attemptId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: all } = useAdminResults();
  const r = all?.find((x) => x.id === attemptId);
  const qs = useQuery({
    enabled: !!r,
    queryKey: ["admin-test-qs", r?.test_id],
    queryFn: async () => (await supabase.from("questions").select("*").eq("test_id", r!.test_id).order("position").order("created_at")).data ?? [],
  });
  if (!r) return <p>Loading...</p>;
  const answers = r.answers as Record<string, string>;
  const manual = r.manual_marks as Record<string, number>;

  async function reset() {
    if (!confirm("Delete this attempt so the student can retake the test?")) return;
    const { error } = await supabase.rpc("admin_reset_attempt", { _attempt_id: attemptId });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-results"] });
    navigate({ to: "/admin/results" });
  }

  return (
    <div className="max-w-3xl">
      <Link to="/admin/results" className="text-sm text-primary">← Results</Link>
      <h1 className="mt-2 text-3xl font-extrabold">{r.student_name}</h1>
      <p className="text-muted-foreground">{r.test_title} · {r.student_class} · {r.student_code}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Score", `${r.score}/${r.total}`], ["Percentage", `${r.percent}%`], ["Correct", r.correct_count], ["Status", r.status !== "submitted" ? "In progress" : r.pending_grading ? "Needs marking" : r.passed ? "Passed" : "Failed"]].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-xl font-bold">{v}</p></div>
        ))}
      </div>

      <h2 className="mt-8 text-xl font-bold">Exam supervision</h2>
      <div className="mt-3 rounded-2xl border bg-card p-4"><ProctorReview attemptId={r.id} /></div>

      <h2 className="mt-8 text-xl font-bold">Submitted answers</h2>
      <div className="mt-3 space-y-3">
        {(qs.data ?? []).map((q, i) => {
          const a = answers[q.id] ?? "";
          let ok: boolean | null = null;
          if (q.type === "written") ok = q.id in manual ? Number(manual[q.id]) > 0 : null;
          else if (!a) ok = false;
          else if (q.type === "short") ok = q.correct_answer.split("|").some((x) => x.trim().toLowerCase() === a.trim().toLowerCase());
          else ok = a.toLowerCase() === q.correct_answer.toLowerCase();
          const display = q.type === "mcq" && a ? `${a}. ${(q.options as string[])[a.charCodeAt(0) - 65] ?? ""}` : a;
          return (
            <div key={q.id} className={cn("rounded-2xl border-2 bg-card p-4", ok === true ? "border-success/50" : ok === false ? "border-destructive/40" : "border-accent")}>
              <p className="text-xs font-bold uppercase text-muted-foreground">Question {i + 1} · {q.marks} mark(s)</p>
              <p className="mt-1 font-bold">{q.text}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm"><span className="text-muted-foreground">Answer: </span>{display || <em>Not answered</em>}</p>
              {q.type !== "written" && <p className="text-sm text-success">Correct: {q.correct_answer}</p>}
              {q.type === "written" && r.status === "submitted" && (
                <GradeBox attemptId={r.id} questionId={q.id} max={Number(q.marks)} current={manual[q.id]} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-results"] })} />
              )}
            </div>
          );
        })}
      </div>
      <Button variant="ghost" className="mt-6 text-destructive" onClick={reset}>Allow retake (delete attempt)</Button>
    </div>
  );
}

function GradeBox({ attemptId, questionId, max, current, onSaved }: { attemptId: string; questionId: string; max: number; current?: number | undefined; onSaved: () => void }) {
  const [m, setM] = useState(current !== undefined ? String(current) : "");
  return (
    <div className="mt-3 flex items-center gap-2">
      <Input type="number" min={0} max={max} step="0.5" value={m} onChange={(e) => setM(e.target.value)} className="w-24" placeholder="0" />
      <span className="text-sm text-muted-foreground">/ {max}</span>
      <Button size="sm" onClick={async () => {
        const n = Math.min(max, Math.max(0, Number(m) || 0));
        const { error } = await supabase.rpc("grade_written", { _attempt_id: attemptId, _question_id: questionId, _marks: n });
        if (error) { toast.error(error.message); return; }
        toast.success("Mark saved");
        onSaved();
      }}>Save mark</Button>
    </div>
  );
}

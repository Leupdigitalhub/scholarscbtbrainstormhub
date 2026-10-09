import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock, FileQuestion, PlayCircle } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({ meta: [{ title: "Start Exam — SCHOLARS CBT" }, { name: "description", content: "Your available examinations." }] }),
  component: Exams,
});

function Exams() {
  const tests = useQuery({ queryKey: ["student-tests"], queryFn: async () => (await supabase.rpc("student_tests")).data ?? [] });
  const results = useQuery({ queryKey: ["my-results"], queryFn: async () => (await supabase.rpc("my_results")).data ?? [] });
  const now = Date.now();
  const inProgress = new Set((results.data ?? []).filter((r) => r.status === "in_progress").map((r) => r.test_id));
  const list = (tests.data ?? []).filter((t) => !(t.end_at && new Date(t.end_at).getTime() < now));
  return (
    <StudentShell>
      <h1 className="text-3xl font-extrabold">Start Exam</h1>
      <p className="mt-1 text-muted-foreground">Pick an examination to begin. Make sure your camera is ready.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {tests.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!tests.isLoading && list.length === 0 && <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground sm:col-span-2">No examinations available right now.</p>}
        {list.map((t) => {
          const upcoming = t.start_at && new Date(t.start_at).getTime() > now;
          const canStart = true;
          return (
            <div key={t.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
              <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{t.subject}</span>
              <h2 className="mt-3 text-lg font-bold">{t.title}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><FileQuestion className="h-4 w-4" />{t.question_count} questions</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{t.duration_minutes} min</span>
              </div>
              <div className="mt-auto pt-5">
                {upcoming ? (
                  <span className="flex items-center gap-1 text-sm font-bold"><CalendarClock className="h-4 w-4" />Opens {new Date(t.start_at!).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                ) : canStart ? (
                  <Button asChild className="h-12 w-full bg-success text-success-foreground hover:bg-success/90">
                    <Link to="/test/$testId" params={{ testId: t.id }}><PlayCircle className="mr-2 h-5 w-5" />{inProgress.has(t.id) ? "Continue CBT" : "Start CBT"}</Link>
                  </Button>
                ) : <span className="text-sm font-bold text-muted-foreground">All attempts used</span>}
              </div>
            </div>
          );
        })}
      </div>
    </StudentShell>
  );
}

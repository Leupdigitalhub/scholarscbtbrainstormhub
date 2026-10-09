import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StudentShell } from "@/components/StudentShell";
import { supabase } from "@/integrations/supabase/client";
import { gradeFor, pct, useSettings } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/results")({
  head: () => ({ meta: [{ title: "My Results — SCHOLARS CBT" }, { name: "description", content: "All your result slips." }] }),
  component: Results,
});

function Results() {
  const { data: settings } = useSettings();
  const results = useQuery({ queryKey: ["my-results"], queryFn: async () => (await supabase.rpc("my_results")).data ?? [] });
  const done = (results.data ?? []).filter((r) => r.status === "submitted");
  const released = done.filter((r) => r.show_results && !r.pending_grading);
  const avg = released.length ? Math.round(released.reduce((s, r) => s + pct(r.score, r.total), 0) / released.length) : 0;
  return (
    <StudentShell>
      <h1 className="text-3xl font-extrabold">My Results</h1>
      <p className="mt-1 text-muted-foreground">Tap any exam to open its result slip and corrections.</p>
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[[done.length, "Exams taken"], [`${avg}%`, "Average"], [released.filter((r) => pct(r.score, r.total) >= r.pass_percentage).length, "Passed"]].map(([n, l]) => (
          <div key={l as string} className="rounded-2xl border bg-card p-4"><p className="font-display text-2xl font-extrabold text-primary">{n}</p><p className="text-xs font-bold uppercase text-muted-foreground">{l}</p></div>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {done.length === 0 && <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">No results yet. Take an exam to see it here.</p>}
        {done.map((r) => {
          const p = pct(r.score, r.total);
          const ok = r.show_results && !r.pending_grading;
          return (
            <Link key={r.attempt_id} to="/result/$attemptId" params={{ attemptId: r.attempt_id }} className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:bg-muted">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.test_title}</p>
                <p className="text-sm text-muted-foreground">{r.subject} · {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString([], { dateStyle: "medium" }) : ""}</p>
                {ok && <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={p >= r.pass_percentage ? "h-full bg-success" : "h-full bg-destructive"} style={{ width: `${p}%` }} /></div>}
              </div>
              {ok ? (
                <div className="text-right"><p className="font-display text-2xl font-extrabold">{p}%</p><p className="text-sm font-bold">Grade {gradeFor(p, settings?.grade_scale)}</p></div>
              ) : <span className="text-sm text-muted-foreground">{r.pending_grading ? "Marking" : "Not released"}</span>}
            </Link>
          );
        })}
      </div>
    </StudentShell>
  );
}

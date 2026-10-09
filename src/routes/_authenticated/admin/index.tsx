import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pct } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { data } = useQuery({
    queryKey: ["admin-summary"],
    queryFn: async () => {
      const [roles, tests, attempts] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "student"),
        supabase.from("tests").select("id,status"),
        supabase.from("attempts").select("score,total").eq("status", "submitted"),
      ]);
      const a = attempts.data ?? [];
      const avg = a.length ? Math.round(a.reduce((s, x) => s + pct(x.score, x.total), 0) / a.length) : 0;
      return { students: roles.data?.length ?? 0, tests: tests.data?.length ?? 0, published: (tests.data ?? []).filter((t) => t.status === "published").length, completed: a.length, avg };
    },
  });
  const cards = [
    ["Total Students", data?.students],
    ["Total Tests", data?.tests],
    ["Published Tests", data?.published],
    ["Completed Tests", data?.completed],
    ["Average Score", data ? `${data.avg}%` : undefined],
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Dashboard</h1>
        <Button asChild><Link to="/admin/tests/new">Create New Test</Link></Button>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{l}</p>
            <p className="mt-1 font-display text-4xl font-extrabold">{v ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-bold">How it works</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Create a test and add questions with correct answers.</li>
          <li>Preview it and click Publish Test.</li>
          <li>Share your website link with students.</li>
          <li>Watch results arrive in Results and mark written answers.</li>
        </ol>
        <p className="mt-4 text-sm">Student link: <span className="font-mono font-bold">{typeof window !== "undefined" ? window.location.origin : ""}</span></p>
      </div>
    </div>
  );
}

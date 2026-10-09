import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/tests/")({
  component: TestsList,
});

function StatusBadge({ s }: { s: string }) {
  return <Badge variant={s === "published" ? "default" : s === "closed" ? "destructive" : "secondary"} className="capitalize">{s}</Badge>;
}

function TestsList() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-tests"],
    queryFn: async () => (await supabase.from("tests").select("*, questions(count)").order("created_at", { ascending: false })).data ?? [],
  });
  async function del(id: string) {
    if (!confirm("Delete this test, its questions and all results? This cannot be undone.")) return;
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-tests"] });
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">My Tests</h1>
        <Button asChild><Link to="/admin/tests/new">Create New Test</Link></Button>
      </div>
      <div className="mt-6 space-y-3">
        {data?.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">No tests yet.</p>}
        {data?.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div>
              <div className="flex items-center gap-2"><p className="text-lg font-bold">{t.title}</p><StatusBadge s={t.status} /></div>
              <p className="text-sm text-muted-foreground">
                {t.subject} · {t.class || "All classes"} · {(t.questions as unknown as { count: number }[])[0]?.count ?? 0} questions · {t.duration_minutes} min
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm"><Link to="/admin/tests/$testId" params={{ testId: t.id }}>Open</Link></Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del(t.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

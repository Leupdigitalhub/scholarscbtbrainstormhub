import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, Camera, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LiveView, ProctorReview } from "@/components/Proctor";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/live")({
  head: () => ({ meta: [{ title: "Live Monitor — SCHOLARS CBT" }, { name: "robots", content: "noindex" }] }),
  component: LiveMonitor,
});

function useNow() {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(t); }, []);
  return n;
}

function LiveMonitor() {
  const now = useNow();
  const [sel, setSel] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-live"],
    refetchInterval: 10000,
    queryFn: async () => {
      const rows = (await supabase.rpc("admin_live_attempts")).data ?? [];
      const paths = rows.map((r) => r.last_photo).filter((p): p is string => !!p);
      const signed = paths.length ? (await supabase.storage.from("proctor").createSignedUrls(paths, 600)).data ?? [] : [];
      const map = new Map(signed.map((s) => [s.path, s.signedUrl]));
      return rows.map((r) => ({ ...r, url: r.last_photo ? map.get(r.last_photo) : undefined }));
    },
  });
  useEffect(() => { if (data) setTick((t) => t + 1); }, [data]);
  const rows = data ?? [];
  const current = rows.find((r) => r.attempt_id === sel) ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Live Monitor</h1>
          <p className="text-sm text-muted-foreground">Students writing an exam right now. Cards update every 10 seconds; the selected student updates every few seconds. Every exam is recorded so you can replay it later from Results.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border bg-card p-8 text-center text-muted-foreground">No student is writing an exam right now.</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => {
              const left = Math.max(0, Math.floor((new Date(r.deadline).getTime() - now) / 1000));
              const flagged = r.tab_switches > 0 || r.camera_off > 0;
              return (
                <button key={r.attempt_id} onClick={() => setSel(r.attempt_id)}
                  className={cn("overflow-hidden rounded-2xl border-2 bg-card text-left transition",
                    sel === r.attempt_id ? "border-primary" : flagged ? "border-destructive/50" : "border-border")}>
                  <div className="relative aspect-[4/3] bg-muted">
                    {r.url ? <img src={r.url} alt={r.full_name ?? "Student"} className="h-full w-full object-cover" /> :
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Camera className="mr-2 h-4 w-4" />No photo yet</div>}
                    {flagged && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground"><AlertTriangle className="h-3 w-3" />Alert</span>}
                  </div>
                  <div className="p-3">
                    <p className="truncate font-bold">{r.full_name || "Student"}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.class} · {r.test_title}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-success" style={{ width: `${r.total_questions ? (r.answered / r.total_questions) * 100 : 0}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-xs">
                      <span>{r.answered}/{r.total_questions} answered</span>
                      <span className="font-bold">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left</span>
                    </div>
                    {flagged && <p className="mt-1 text-xs font-bold text-destructive">{r.tab_switches} tab switches{r.camera_off ? ` · camera off ${r.camera_off}×` : ""}</p>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border bg-card p-4 lg:sticky lg:top-6 lg:self-start">
            {!current ? <p className="text-sm text-muted-foreground">Tap a student to see all their photos.</p> : (
              <>
                <p className="font-bold">{current.full_name}</p>
                <p className="mb-3 text-xs text-muted-foreground">{current.test_title}</p>
                <div className="mb-4"><LiveView key={current.attempt_id} attemptId={current.attempt_id} /></div>
                <ProctorReview key={`${current.attempt_id}-${tick}`} attemptId={current.attempt_id} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

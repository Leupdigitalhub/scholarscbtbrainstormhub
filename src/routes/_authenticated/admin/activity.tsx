import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogIn, PlayCircle, Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  component: ActivityCenter,
});

const filters = [
  { k: "all", l: "All" }, { k: "login", l: "Sign-ins" }, { k: "started", l: "Started" }, { k: "submitted", l: "Submitted" }, { k: "alerts", l: "Alerts" },
];

function ActivityCenter() {
  const [f, setF] = useState("all");
  const q = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async () => (await supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
    refetchInterval: 15000,
  });
  useEffect(() => {
    const ch = supabase.channel("activity-feed").on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, () => void q.refetch()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [q]);
  const rows = (q.data ?? []).filter((n) => f === "all" || (f === "alerts" ? ["tab_switch", "camera_off"].includes(n.kind) : n.kind === f));
  const today = (q.data ?? []).filter((n) => n.kind === "login" && new Date(n.created_at).toDateString() === new Date().toDateString()).length;
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Activity Center</h1>
      <p className="text-muted-foreground">Live log of student sign-ins and exam activity. <b className="text-foreground">{today}</b> sign-ins today.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((x) => (
          <button key={x.k} onClick={() => setF(x.k)} className={cn("rounded-full px-4 py-1.5 text-sm font-bold", f === x.k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}>{x.l}</button>
        ))}
      </div>
      <div className="mt-4 divide-y rounded-2xl border bg-card">
        {rows.length === 0 ? <p className="p-6 text-center text-muted-foreground">Nothing here yet.</p> : rows.map((n) => {
          const Icon = n.kind === "login" ? LogIn : n.kind === "submitted" ? Send : n.kind === "started" ? PlayCircle : AlertTriangle;
          const alert = n.kind === "tab_switch" || n.kind === "camera_off";
          return (
            <div key={n.id} className="flex items-start gap-3 p-4">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", alert ? "bg-destructive/15 text-destructive" : n.kind === "login" ? "bg-success/15 text-success" : "bg-primary/10 text-primary")}><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground">{n.body.replace(/\s*·?\s*id:[0-9a-f-]+$/, "")}</p>}
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

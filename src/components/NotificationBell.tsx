import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY = ["admin-notifications"];

/** Admin bell: live activity feed, plus a presence ping so offline emails pause while the admin is here. */
export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const first = useRef(true);
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  useEffect(() => {
    const beat = () => void supabase.rpc("admin_heartbeat");
    beat();
    const t = setInterval(beat, 60_000);
    const ch = supabase.channel("admin-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (p) => {
        const n = p.new as { title: string; body: string };
        if (!first.current) toast(n.title, { description: n.body });
        void qc.invalidateQueries({ queryKey: KEY });
        void qc.invalidateQueries({ queryKey: ["admin-live"] });
      })
      .subscribe();
    first.current = false;
    return () => { clearInterval(t); void supabase.removeChannel(ch); };
  }, [qc]);

  const items = data ?? [];
  const unread = items.filter((n) => !n.is_read).length;
  async function markAll() {
    await supabase.from("admin_notifications").update({ is_read: true }).eq("is_read", false);
    void qc.invalidateQueries({ queryKey: KEY });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold hover:bg-sidebar-accent" aria-label="Notifications">
          <Bell className="h-4 w-4" />Notifications
          {unread > 0 && <span className="rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center justify-between border-b p-3">
          <p className="font-bold">Activity</p>
          {unread > 0 && <Button size="sm" variant="ghost" onClick={markAll}>Mark all read</Button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No activity yet.</p> : items.map((n) => (
            <Link key={n.id} to={n.kind === "submitted" && n.attempt_id ? "/admin/results/$attemptId" : n.kind === "login" ? "/admin/activity" : "/admin/live"}
              params={{ attemptId: n.attempt_id ?? "" }} onClick={() => setOpen(false)}
              className={cn("block border-b p-3 text-sm hover:bg-muted", !n.is_read && "bg-primary/5")}>
              <p className={cn("font-bold", (n.kind === "tab_switch" || n.kind === "camera_off") && "text-destructive")}>{n.title}</p>
              {n.body && <p className="text-muted-foreground">{n.body.replace(/\s*·?\s*id:[0-9a-f-]+$/, "")}</p>}
              <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Megaphone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

/** Title prefix marking an announcement that asks students to reply. */
export const REPLY_TAG = "[Reply] ";
export const parseNotice = (title: string) =>
  title.startsWith(REPLY_TAG) ? { reply: true, title: title.slice(REPLY_TAG.length) } : { reply: false, title };

const SEEN_KEY = "notif-seen-at";

/** Notification bell with unread count; opens a drawer of admin messages. */
export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState("");
  useEffect(() => { setSeen(localStorage.getItem(SEEN_KEY) ?? ""); }, []);
  const { data } = useQuery({
    queryKey: ["my-announcements"],
    queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  useEffect(() => {
    const ch = supabase.channel(`student-announcements-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (p) => {
        if (p.eventType === "INSERT") toast.info("You have a new notification");
        void qc.invalidateQueries({ queryKey: ["my-announcements"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);
  const items = data ?? [];
  const unread = items.filter((a) => a.created_at > seen).length;
  function openPanel() {
    setOpen(true);
    const now = new Date().toISOString();
    localStorage.setItem(SEEN_KEY, now);
    setTimeout(() => setSeen(now), 300);
  }
  return (
    <>
      <button aria-label="Notifications" onClick={openPanel} className="relative rounded-lg p-2 hover:bg-sidebar-accent">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-destructive px-1 text-center text-xs font-bold text-destructive-foreground">{unread}</span>}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>Notifications</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2">
            {items.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
            {items.map((a) => {
              const n = parseNotice(a.title);
              const isNew = a.created_at > seen;
              return (
                <div key={a.id} className={`rounded-xl border p-3 ${isNew ? "border-primary bg-primary/5" : "bg-card"}`}>
                  <p className="flex items-center gap-2 font-bold">
                    {n.reply ? <MessageCircle className="h-4 w-4 text-primary" /> : <Megaphone className="h-4 w-4 text-primary" />}{n.title}
                  </p>
                  {a.body && <p className="mt-1 whitespace-pre-wrap text-sm">{a.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()} · {n.reply ? "Your reply is requested" : "Notice — no reply needed"}</p>
                  {n.reply && <Button asChild size="sm" className="mt-2"><Link to="/messages" onClick={() => setOpen(false)}>Reply to admin</Link></Button>}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

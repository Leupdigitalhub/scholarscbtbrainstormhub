import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Messages from the examiner, shown on the student dashboard and updated live. */
export function Announcements() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-announcements"],
    queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(10)).data ?? [],
  });
  useEffect(() => {
    const ch = supabase.channel("student-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (p) => {
        if (p.eventType === "INSERT") toast.info(`New message: ${(p.new as { title: string }).title}`);
        void qc.invalidateQueries({ queryKey: ["my-announcements"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);
  const items = data ?? [];
  if (!items.length) return null;
  return (
    <div className="mt-6 space-y-2">
      {items.map((a) => (
        <div key={a.id} className="rounded-2xl border-2 border-accent bg-accent/40 p-4">
          <p className="flex items-center gap-2 font-bold"><Megaphone className="h-4 w-4 text-primary" />{a.title}</p>
          {a.body && <p className="mt-1 whitespace-pre-wrap text-sm">{a.body}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

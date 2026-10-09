import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { loadThread, supportTable } from "@/lib/support-messages";

/** One student's conversation with the admin. `me` decides which side the bubbles sit on. */
export function ChatThread({ studentId, me }: { studentId: string; me: "student" | "admin" }) {
  const qc = useQueryClient();
  const key = ["support-thread", studentId];
  const q = useQuery({ queryKey: key, queryFn: () => loadThread(studentId), refetchInterval: 5000, retry: false });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const rows = q.data ?? [];
  const unreadFromOther = rows.filter((m) => m.sender !== me && !m.is_read).length;

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [rows.length]);
  useEffect(() => {
    if (!unreadFromOther) return;
    void supportTable().update({ is_read: true }).eq("student_id", studentId).eq("sender", me === "admin" ? "student" : "admin").eq("is_read", false)
      .then(() => { void qc.invalidateQueries({ queryKey: ["support-inbox"] }); void qc.invalidateQueries({ queryKey: ["support-unread"] }); });
  }, [unreadFromOther, studentId, me, qc]);
  useEffect(() => {
    const ch = supabase.channel(`support-${studentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `student_id=eq.${studentId}` }, () => void qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, qc]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supportTable().insert({ student_id: studentId, sender: me, body: body.slice(0, 2000) });
    setBusy(false);
    if (error) { toast.error("Message could not be sent. Please try again later."); return; }
    setText("");
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["support-inbox"] });
  }

  if (q.error) return <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Messaging is not switched on yet. Please check back soon.</p>;

  return (
    <div className="flex h-[65vh] flex-col rounded-2xl border bg-card">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{me === "student" ? "No messages yet. Ask your examiner anything below." : "No messages in this conversation yet."}</p>}
        {rows.map((m) => (
          <div key={m.id} className={cn("flex", m.sender === me ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", m.sender === me ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="mt-0.5 text-[10px] opacity-70">{m.sender === "admin" ? "Admin" : "Student"} · {new Date(m.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="min-h-11 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(e); } }} />
        <Button disabled={busy || !text.trim()} aria-label="Send" className="h-11"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

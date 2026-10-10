import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLists } from "@/lib/auth";
import { ChatThread } from "@/components/ChatThread";
import { loadThread } from "@/lib/support-messages";
import { cn } from "@/lib/utils";
import { REPLY_TAG, parseNotice } from "@/components/Announcements";

function Inbox({ names }: { names: Map<string, string> }) {
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["support-inbox"], queryFn: () => loadThread(), refetchInterval: 10000, retry: false });
  if (q.error) return <p className="mt-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">Student inbox is not switched on yet (the messages table still needs to be added to your backend).</p>;
  const threads = new Map<string, { last: string; at: string; unread: number }>();
  for (const m of q.data ?? []) {
    const t = threads.get(m.student_id) ?? { last: "", at: "", unread: 0 };
    t.last = m.body; t.at = m.created_at;
    if (m.sender === "student" && !m.is_read) t.unread++;
    threads.set(m.student_id, t);
  }
  const list = [...threads.entries()].sort((a, b) => b[1].at.localeCompare(a[1].at));
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-[260px_1fr]">
      <div className="max-h-[65vh] divide-y overflow-y-auto rounded-2xl border bg-card">
        {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">No student messages yet.</p>}
        {list.map(([sid, t]) => (
          <button key={sid} onClick={() => setOpen(sid)} className={cn("block w-full p-3 text-left hover:bg-muted", open === sid && "bg-primary/10")}>
            <p className="flex items-center justify-between font-bold"><span className="truncate">{names.get(sid) || "Student"}</span>
              {t.unread > 0 && <span className="rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{t.unread}</span>}</p>
            <p className="truncate text-xs text-muted-foreground">{t.last}</p>
          </button>
        ))}
      </div>
      {open ? <ChatThread key={open} studentId={open} me="admin" /> : <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">Choose a conversation to read and reply.</p>}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/messages")({
  head: () => ({ meta: [{ title: "Messages to Students — SCHOLARS CBT" }, { name: "robots", content: "noindex" }] }),
  component: Messages,
});

function Messages() {
  const qc = useQueryClient();
  const { data: lists } = useLists();
  const students = useQuery({ queryKey: ["msg-students"], queryFn: async () => (await supabase.from("profiles").select("id,full_name,class").order("full_name")).data ?? [] });
  const list = useQuery({ queryKey: ["announcements"], queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [f, setF] = useState({ title: "", body: "", target: "all", value: "", reply: false });
  const [busy, setBusy] = useState(false);
  const names = new Map((students.data ?? []).map((s) => [s.id, s.full_name]));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (f.target !== "all" && !f.value) { toast.error("Choose who should get this message"); return; }
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({
      title: (f.reply ? REPLY_TAG : "") + f.title.trim(), body: f.body.trim(),
      target_class: f.target === "class" ? f.value : "",
      target_student: f.target === "student" ? f.value : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Message sent");
    setF({ title: "", body: "", target: "all", value: "", reply: false });
    void qc.invalidateQueries({ queryKey: ["announcements"] });
  }
  async function remove(id: string) {
    await supabase.from("announcements").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-extrabold">Student Inbox</h1>
      <p className="text-sm text-muted-foreground">Private messages from students. Tap one to reply.</p>
      <Inbox names={new Map((students.data ?? []).map((s) => [s.id, s.full_name ?? ""]))} />
      <h1 className="mt-10 text-2xl font-extrabold">Messages to Students</h1>
      <p className="text-sm text-muted-foreground">Students see these in their notification bell.</p>
      <form onSubmit={send} className="mt-5 space-y-4 rounded-2xl border bg-card p-5">
        <div className="space-y-1.5"><Label>Title</Label><Input required value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Mock exam on Friday" /></div>
        <div className="space-y-1.5"><Label>Message</Label><Textarea rows={4} value={f.body} onChange={(e) => setF((p) => ({ ...p, body: e.target.value }))} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Send to</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3" value={f.target} onChange={(e) => setF((p) => ({ ...p, target: e.target.value, value: "" }))}>
              <option value="all">All students</option><option value="class">One class</option><option value="student">One student</option>
            </select>
          </div>
          {f.target === "class" && <div className="space-y-1.5"><Label>Class</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3" value={f.value} onChange={(e) => setF((p) => ({ ...p, value: e.target.value }))}>
              <option value="">Choose...</option>{(lists?.classes ?? []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select></div>}
          {f.target === "student" && <div className="space-y-1.5"><Label>Student</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3" value={f.value} onChange={(e) => setF((p) => ({ ...p, value: e.target.value }))}>
              <option value="">Choose...</option>{(students.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name || "Unnamed"}{s.class ? ` (${s.class})` : ""}</option>)}
            </select></div>}
        </div>
        <div className="flex gap-2">{[{ v: false, l: "Notice — no reply needed" }, { v: true, l: "Ask for their reply" }].map((o) => <Button key={o.l} type="button" variant={f.reply === o.v ? "default" : "outline"} size="sm" onClick={() => setF((p) => ({ ...p, reply: o.v }))}>{o.l}</Button>)}</div>
        <Button disabled={busy}>{busy ? "Sending..." : "Send message"}</Button>
      </form>
      <h2 className="mt-8 text-lg font-bold">Sent messages</h2>
      <div className="mt-3 space-y-2">
        {(list.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing sent yet.</p>}
        {(list.data ?? []).map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
            <div>
              <p className="font-bold">{parseNotice(a.title).title} <span className="ml-1 rounded bg-muted px-1.5 text-xs font-normal">{parseNotice(a.title).reply ? "Reply requested" : "No reply"}</span></p>
              {a.body && <p className="whitespace-pre-wrap text-sm">{a.body}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                To {a.target_student ? names.get(a.target_student) ?? "one student" : a.target_class || "all students"} · {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

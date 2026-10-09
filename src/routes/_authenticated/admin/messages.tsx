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

export const Route = createFileRoute("/_authenticated/admin/messages")({
  head: () => ({ meta: [{ title: "Messages to Students — SCHOLARS CBT" }, { name: "robots", content: "noindex" }] }),
  component: Messages,
});

function Messages() {
  const qc = useQueryClient();
  const { data: lists } = useLists();
  const students = useQuery({ queryKey: ["msg-students"], queryFn: async () => (await supabase.from("profiles").select("id,full_name,class").order("full_name")).data ?? [] });
  const list = useQuery({ queryKey: ["announcements"], queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [f, setF] = useState({ title: "", body: "", target: "all", value: "" });
  const [busy, setBusy] = useState(false);
  const names = new Map((students.data ?? []).map((s) => [s.id, s.full_name]));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (f.target !== "all" && !f.value) { toast.error("Choose who should get this message"); return; }
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({
      title: f.title.trim(), body: f.body.trim(),
      target_class: f.target === "class" ? f.value : "",
      target_student: f.target === "student" ? f.value : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Message sent");
    setF({ title: "", body: "", target: "all", value: "" });
    void qc.invalidateQueries({ queryKey: ["announcements"] });
  }
  async function remove(id: string) {
    await supabase.from("announcements").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold">Messages to Students</h1>
      <p className="text-sm text-muted-foreground">Students see these instantly at the top of their dashboard.</p>
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
        <Button disabled={busy}>{busy ? "Sending..." : "Send message"}</Button>
      </form>
      <h2 className="mt-8 text-lg font-bold">Sent messages</h2>
      <div className="mt-3 space-y-2">
        {(list.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing sent yet.</p>}
        {(list.data ?? []).map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
            <div>
              <p className="font-bold">{a.title}</p>
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/syllabus")({
  head: () => ({ meta: [{ title: "Study Topics SS1–SS3 — SCHOLARS CBT" }, { name: "description", content: "Your SS1 to SS3 study topics and progress." }] }),
  component: Syllabus,
});

const CLASSES = ["SS 1", "SS 2", "SS 3"];
const SUBJECTS = ["English", "Mathematics", "Physics", "Chemistry", "Biology"];
const TERMS = ["1st Term", "2nd Term", "3rd Term"];

function Syllabus() {
  const qc = useQueryClient();
  const [cls, setCls] = useState("SS 1");
  const [sub, setSub] = useState("English");
  const topics = useQuery({ queryKey: ["topics"], queryFn: async () => (await supabase.from("study_topics").select("*").order("topic_order")).data ?? [] });
  const done = useQuery({ queryKey: ["topic-progress"], queryFn: async () => new Set(((await supabase.from("student_topic_progress").select("topic_id")).data ?? []).map((r) => r.topic_id)) });
  const list = (topics.data ?? []).filter((t) => t.class_name === cls && t.subject_name === sub);
  const doneSet = done.data ?? new Set<string>();
  const count = list.filter((t) => doneSet.has(t.id)).length;
  const percent = list.length ? Math.round((count / list.length) * 100) : 0;

  async function toggle(id: string) {
    if (doneSet.has(id)) await supabase.from("student_topic_progress").delete().eq("topic_id", id);
    else await supabase.from("student_topic_progress").insert({ topic_id: id });
    qc.invalidateQueries({ queryKey: ["topic-progress"] });
  }

  const pill = (active: boolean) => `rounded-full px-4 py-2 text-sm font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`;

  return (
    <StudentShell>
      <Link to="/dashboard" className="text-sm text-primary">← Back to dashboard</Link>
      <h1 className="mt-2 text-3xl font-extrabold">Study Topics</h1>
      <div className="mt-4 flex flex-wrap gap-2">{CLASSES.map((c) => <button key={c} className={pill(c === cls)} onClick={() => setCls(c)}>{c}</button>)}</div>
      <div className="mt-3 flex flex-wrap gap-2">{SUBJECTS.map((s) => <button key={s} className={pill(s === sub)} onClick={() => setSub(s)}>{s}</button>)}</div>
      <div className="mt-5 rounded-2xl border bg-card p-4">
        <p className="text-sm font-bold">{count} of {list.length} topics studied · {percent}%</p>
        <div className="mt-2 h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-success" style={{ width: `${percent}%` }} /></div>
      </div>
      {TERMS.map((term) => {
        const items = list.filter((t) => t.term === term);
        if (!items.length) return null;
        return (
          <section key={term} className="mt-6">
            <h2 className="mb-2 text-lg font-extrabold text-primary">{term}</h2>
            <div className="space-y-2">
              {items.map((t) => (
                <button key={t.id} onClick={() => toggle(t.id)} className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left hover:bg-muted">
                  {doneSet.has(t.id) ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  <span className={doneSet.has(t.id) ? "line-through opacity-70" : ""}>{t.title}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </StudentShell>
  );
}

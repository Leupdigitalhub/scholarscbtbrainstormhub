import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TestForm } from "@/components/TestForm";
import { ImportQuestions } from "@/components/ImportQuestions";
import { BankPicker } from "@/components/BankPicker";
import { fetchAll } from "@/lib/admin-data";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/tests/$testId")({
  component: EditTest,
});

type Question = Tables<"questions">;
const typeLabel: Record<string, string> = { mcq: "Multiple Choice", true_false: "True/False", short: "Short Answer", written: "Written Answer" };

function EditTest() {
  const { testId } = Route.useParams();
  const qc = useQueryClient();
  const test = useQuery({ queryKey: ["admin-test", testId], queryFn: async () => (await supabase.from("tests").select("*").eq("id", testId).single()).data });
  const qs = useQuery({
    queryKey: ["admin-test-qs", testId],
    queryFn: () => fetchAll<Question>((from, to) =>
      supabase.from("questions").select("*").eq("test_id", testId).order("position").order("created_at").range(from, to)),
  });
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [subj, setSubj] = useState("");
  const t = test.data;
  if (!t) return <p>Loading...</p>;
  const questions = qs.data ?? [];
  const subjects = t.multi_subject ? [...t.compulsory_subjects, ...t.elective_subjects] : [];
  const cur = t.multi_subject ? (subj || subjects[0] || "") : "";
  const countOf = (n: string) => questions.filter((q) => q.subject.toLowerCase() === n.toLowerCase()).length;
  const list = t.multi_subject ? questions.filter((q) => q.subject.toLowerCase() === cur.toLowerCase()) : questions;
  const shown = showAll ? list : list.slice(0, 50);
  const need = (n: string) => t.per_subject_count + (t.compulsory_subjects.includes(n) ? 10 : 0);
  const short = subjects.filter((n) => countOf(n) < need(n));
  const total = questions.reduce((s, q) => s + Number(q.marks), 0);
  const drawn = t.draw_count && t.draw_count < questions.length ? t.draw_count : questions.length;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-test-qs", testId] }); qc.invalidateQueries({ queryKey: ["admin-tests"] }); };

  const setStatus = async (status: string) => {
    if (status === "published" && t.multi_subject && short.length) {
      toast.error(`Not enough questions. Add more to: ${short.map((n) => `${n} (needs ${need(n)})`).join(", ")}`);
      return;
    }
    if (status === "published" && questions.length === 0) { toast.error("Add at least one question first"); return; }
    if (status === "published" && !t.multi_subject && t.draw_count && t.draw_count > questions.length) {
      toast.error(`You asked to give each student ${t.draw_count} questions, but this test has only ${questions.length}. Add more questions or lower the number.`);
      return;
    }
    const { error } = await supabase.from("tests").update({ status }).eq("id", testId);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "published" ? "Test published! Students can now see it." : status === "closed" ? "Test closed" : "Saved as draft");
    qc.invalidateQueries({ queryKey: ["admin-test", testId] });
    qc.invalidateQueries({ queryKey: ["admin-tests"] });
  };
  async function del(id: string) {
    if (!confirm("Delete this question?")) return;
    await supabase.from("questions").delete().eq("id", id);
    refresh();
  }

  return (
    <div className="max-w-4xl">
      <Link to="/admin/tests" className="text-sm text-primary">← My Tests</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{t.title}</h1>
        <Badge variant={t.status === "published" ? "default" : t.status === "closed" ? "destructive" : "secondary"} className="capitalize">{t.status}</Badge>
      </div>

      <Tabs defaultValue="questions" className="mt-6">
        <TabsList>
          <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="preview">Preview & Publish</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4 space-y-3">
          {t.multi_subject && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {subjects.map((n) => (
                <button key={n} type="button" onClick={() => { setSubj(n); setEditing(null); setShowAll(false); }}
                  className={`rounded-xl border-2 p-3 text-left ${n === cur ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                  <p className="font-bold">{n}</p>
                  <p className="text-xs text-muted-foreground">{countOf(n)} / {need(n)} needed{t.compulsory_subjects.includes(n) ? " · Compulsory" : ""}</p>
                </button>
              ))}
            </div>
          )}
          {t.multi_subject && <p className="text-sm font-bold">Adding questions to: {cur}</p>}
          {shown.map((q, i) => editing !== "new" && editing?.id === q.id ? (
            <QuestionEditor key={q.id} subject={q.subject} testId={testId} q={q} position={q.position} onDone={() => { setEditing(null); refresh(); }} />
          ) : (
            <div key={q.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Question {i + 1} · {typeLabel[q.type]} · {q.marks} mark(s)</p>
                  <p className="mt-1 whitespace-pre-wrap font-bold">{q.text}</p>
                  {q.type === "mcq" && (
                    <p className="mt-1 text-sm">{(q.options as string[]).map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join("   ")}</p>
                  )}
                  <p className="mt-1 text-sm text-success">Correct: {q.type === "written" ? "Marked manually" : q.correct_answer}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(q)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(q.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
          {list.length > shown.length && !editing && (
            <Button variant="outline" className="h-12 w-full border-dashed" onClick={() => setShowAll(true)}>
              Show all {list.length} questions
            </Button>
          )}
          {editing === "new" ? (
            <QuestionEditor key={cur} subject={cur} testId={testId} position={questions.length + 1} onDone={() => { setEditing(null); refresh(); }} onSaveAnother={refresh} />
          ) : (
            <div className="space-y-3">
              <BankPicker key={"b" + cur} subject={cur} testId={testId} position={questions.length + 1} onDone={refresh} />
              <Button variant="outline" className="h-12 w-full border-dashed" onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" />Add Question</Button>
              <ImportQuestions key={cur} subject={cur} testId={testId} position={questions.length + 1} onDone={refresh} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-4 rounded-2xl border bg-card p-6">
          <TestForm key={t.id + t.title} initial={t} questionCount={questions.length} submitLabel="Save Details" onSubmit={async (v) => {
            const { error } = await supabase.from("tests").update(v).eq("id", testId);
            if (error) { toast.error(error.message); return; }
            toast.success("Saved");
            qc.invalidateQueries({ queryKey: ["admin-test", testId] });
          }} />
        </TabsContent>

        <TabsContent value="preview" className="mt-4 rounded-2xl border bg-card p-6">
          <h2 className="text-xl font-bold">Test Preview</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[
              ["Test name", t.title], ["Subject", t.subject], ["Class", t.class || "All classes"],
              ["Questions", questions.length], ["Total marks", total], ["Duration", `${t.duration_minutes} minutes`],
              ["Pass mark", `${t.pass_percentage}%`],
              ...(t.multi_subject ? [["Subjects", subjects.map((n) => `${n}: ${countOf(n)}`).join(", ")], ["Each student gets", `${t.compulsory_subjects.join(", ")} ${t.per_subject_count + 10} + ${t.electives_to_pick} choices × ${t.per_subject_count} = ${t.per_subject_count * (t.compulsory_subjects.length + t.electives_to_pick) + 10 * t.compulsory_subjects.length} questions`]] : []),
              [t.multi_subject ? "Without subjects" : "Each student gets", drawn === questions.length ? `${drawn} questions` : `${drawn} of ${questions.length}, drawn at random`],
              ["Question order", t.shuffle_questions ? "Shuffled for each student" : "Same for everyone"],
              ["Answer options", t.shuffle_options ? "Shuffled for each student" : "Same for everyone"],
              ["Start", t.start_at ? new Date(t.start_at).toLocaleString() : "Anytime"],
              ["End", t.end_at ? new Date(t.end_at).toLocaleString() : "No end"],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-muted p-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-bold">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStatus("draft")}>Save as Draft</Button>
            <Button onClick={() => setStatus("published")}>Publish Test</Button>
            {t.status === "published" && <Button variant="destructive" onClick={() => setStatus("closed")}>Close Test</Button>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuestionEditor({ testId, q, position, onDone, onSaveAnother, subject = "" }: { subject?: string; testId: string; q?: Question; position: number; onDone: () => void; onSaveAnother?: () => void }) {
  const blank = { type: "mcq", text: "", options: ["", "", "", ""], correct_answer: "", marks: 1 };
  const [v, setV] = useState(q ? { type: q.type, text: q.text, options: (q.options as string[]).length ? (q.options as string[]) : ["", "", "", ""], correct_answer: q.correct_answer, marks: Number(q.marks) } : blank);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState(position);

  async function save(another: boolean) {
    if (!v.text.trim()) { toast.error("Enter the question"); return; }
    const options = v.type === "mcq" ? v.options.map((o) => o.trim()).filter(Boolean) : [];
    if (v.type === "mcq" && options.length < 2) { toast.error("Add at least two options"); return; }
    if (v.type !== "written" && !v.correct_answer.trim()) { toast.error("Select or enter the correct answer"); return; }
    setBusy(true);
    const row = { subject, test_id: testId, type: v.type, text: v.text.trim(), options, correct_answer: v.correct_answer.trim(), marks: Number(v.marks) || 1, position: q ? q.position : pos };
    const { error } = q ? await supabase.from("questions").update(row).eq("id", q.id) : await supabase.from("questions").insert(row);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Question saved");
    if (another) { setV(blank); setPos(pos + 1); onSaveAnother?.(); } else onDone();
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-primary bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1.5">
          <Label>Question Type</Label>
          <Select value={v.type} onValueChange={(type) => setV({ ...v, type, correct_answer: "" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Marks</Label><Input type="number" min={0} step="0.5" value={v.marks} onChange={(e) => setV({ ...v, marks: Number(e.target.value) })} /></div>
      </div>
      <div className="space-y-1.5"><Label>Question</Label><Textarea rows={2} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} placeholder="What is 5 × 6?" /></div>

      {v.type === "mcq" && (
        <div className="space-y-2">
          <Label>Options — tap the letter to mark the correct answer</Label>
          {v.options.map((o, i) => {
            const letter = String.fromCharCode(65 + i);
            const sel = v.correct_answer === letter;
            return (
              <div key={i} className="flex gap-2">
                <button type="button" onClick={() => setV({ ...v, correct_answer: letter })}
                  className={`h-10 w-10 shrink-0 rounded-lg border-2 font-bold ${sel ? "border-success bg-success text-success-foreground" : "border-input"}`}>{letter}</button>
                <Input value={o} onChange={(e) => { const opts = [...v.options]; opts[i] = e.target.value; setV({ ...v, options: opts }); }} placeholder={`Option ${letter}`} />
                {v.options.length > 2 && <Button type="button" variant="ghost" size="icon" onClick={() => setV({ ...v, options: v.options.filter((_, j) => j !== i), correct_answer: "" })}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            );
          })}
          {v.options.length < 6 && <Button type="button" variant="ghost" size="sm" onClick={() => setV({ ...v, options: [...v.options, ""] })}><Plus className="mr-1 h-4 w-4" />Add option</Button>}
        </div>
      )}
      {v.type === "true_false" && (
        <div className="space-y-1.5">
          <Label>Correct Answer</Label>
          <div className="flex gap-2">
            {["True", "False"].map((x) => (
              <Button key={x} type="button" variant={v.correct_answer === x ? "default" : "outline"} onClick={() => setV({ ...v, correct_answer: x })}>{x}</Button>
            ))}
          </div>
        </div>
      )}
      {v.type === "short" && (
        <div className="space-y-1.5">
          <Label>Correct Answer</Label>
          <Input value={v.correct_answer} onChange={(e) => setV({ ...v, correct_answer: e.target.value })} placeholder="Abuja" />
          <p className="text-xs text-muted-foreground">Not case-sensitive. Separate accepted alternatives with | (e.g. Abuja|abuja city)</p>
        </div>
      )}
      {v.type === "written" && <p className="rounded-lg bg-muted p-3 text-sm">Students type their answer. You will mark it from the Results page.</p>}

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => save(false)}>Save Question</Button>
        {!q && <Button disabled={busy} variant="secondary" onClick={() => save(true)}><Plus className="mr-1 h-4 w-4" />Save & Add Another</Button>}
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

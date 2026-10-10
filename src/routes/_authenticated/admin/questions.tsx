import { createFileRoute } from "@tanstack/react-router";
import { passageLabel } from "@/lib/passage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/admin-data";
import { ImportQuestions } from "@/components/ImportQuestions";
import { useSubjects } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/admin/questions")({
  head: () => ({ meta: [{ title: "Question Bank — Scholars CBT" }] }),
  component: QuestionBank,
});

function QuestionBank() {
  const qc = useQueryClient();
  const BANK_TABS = useSubjects();
  const [sel, setSub] = useState("");
  const sub = sel || BANK_TABS[0] || "English";
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["bank-questions"],
    queryFn: () => fetchAll((from, to) => supabase.from("bank_questions").select("*").order("created_at").range(from, to)),
  });
  const all = data ?? [];
  const rows = all.filter((x) => x.subject === sub && x.text.toLowerCase().includes(q.toLowerCase()));
  const refresh = () => qc.invalidateQueries({ queryKey: ["bank-questions"] });

  async function del(id: string) {
    if (!confirm("Delete this question from the bank?")) return;
    await supabase.from("bank_questions").delete().eq("id", id);
    refresh();
  }

  async function clearSubject() {
    const n = all.filter((x) => x.subject === sub).length;
    if (!confirm(`Delete ALL ${n} ${sub} questions from the bank? This cannot be undone.`)) return;
    const { error } = await supabase.from("bank_questions").delete().eq("subject", sub);
    if (error) { alert(error.message); return; }
    refresh();
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Question Bank</h1>
      <p className="text-muted-foreground">Import questions, answers and explanations for each subject. Then pick from here when building a test.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {BANK_TABS.map((s) => (
          <Button key={s} variant={s === sub ? "default" : "outline"} className="h-14 flex-col" onClick={() => setSub(s)}>
            <span className="font-bold">{s}</span>
            <span className="text-xs opacity-80">{all.filter((x) => x.subject === s).length} questions</span>
          </Button>
        ))}
      </div>
      <div className="mt-4">
        <ImportQuestions key={sub} bank subject={sub} testId="" position={0} onDone={refresh} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder={`Search ${sub}...`} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="destructive" disabled={!all.some((x) => x.subject === sub)} onClick={clearSubject}>
          <Trash2 className="mr-2 h-4 w-4" />Delete all {sub} questions
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((x, i) => (
          <div key={x.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="text-sm">
              <p className="font-bold">{i + 1}. {passageLabel(x.text)}</p>
              {(x.options as string[]).length > 0 && <p>{(x.options as string[]).map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join("   ")}</p>}
              <p className="text-success">Answer: {x.correct_answer}</p>
              {x.explanation && <p className="whitespace-pre-line text-muted-foreground">Explanation: {x.explanation}</p>}
            </div>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(x.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground">No {sub} questions yet. Use Import above.</p>}
      </div>
    </div>
  );
}

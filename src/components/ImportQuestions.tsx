import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseQuestions, sampleText, type ParsedQ } from "@/lib/question-import";
import { supabase } from "@/integrations/supabase/client";

const SAMPLE = sampleText();

export function ImportQuestions({ testId, position, onDone, subject = "", bank = false }: { bank?: boolean; testId: string; position: number; onDone: () => void; subject?: string }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [file, setFile] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const [result, setResult] = useState<{ questions: ParsedQ[]; problems: string[] } | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  async function readFiles(list: FileList | null) {
    if (!list || !list.length) return;
    setBusy(true);
    const parts: string[] = [];
    const names: string[] = [];
    try {
      for (const f of Array.from(list)) {
        names.push(f.name);
        if (/\.docx$/i.test(f.name)) {
          const mammoth = await import("mammoth");
          const buf = await f.arrayBuffer();
          parts.push((await mammoth.extractRawText({ arrayBuffer: buf })).value);
        } else if (/\.(txt|md|csv|text)$/i.test(f.name)) {
          parts.push(await f.text());
        } else if (/\.(doc|pdf|ppt|pptx|xls|xlsx|zip|rar|jpg|jpeg|png)$/i.test(f.name)) {
          toast.error(`${f.name}: please save it as a Word (.docx) or plain text (.txt) file first.`);
        } else {
          parts.push(await f.text());
        }
      }
      setRaw(parts.join("\n\n"));
      setFile(names.join(", "));
      setResult(null);
      setAdded(0);
    } catch {
      toast.error("That file could not be read. Save it as .docx or .txt and try again.");
    }
    setBusy(false);
  }

  const parsed = result?.questions ?? [];

  async function addAll() {
    if (!parsed.length) return;
    setBusy(true);
    let pos = position;
    let done = 0;
    for (let i = 0; i < parsed.length; i += 100) {
      const slice = parsed.slice(i, i + 100);
      const { error } = bank
        ? await supabase.from("bank_questions").insert(slice.map((q) => ({
            type: q.type, text: q.text, options: q.options, correct_answer: q.correct_answer, marks: q.marks, subject, explanation: q.explanation ?? "",
          })))
        : await supabase.from("questions").insert(slice.map((q) => ({
            test_id: testId, type: q.type, text: q.text, options: q.options,
            correct_answer: q.correct_answer, marks: q.marks, position: pos++, subject, explanation: q.explanation ?? "",
          })));
      const chunk = slice;
      if (error) { toast.error(`Stopped after ${done}: ${error.message}`); setBusy(false); return; }
      done += chunk.length;
      setAdded(done);
    }
    setBusy(false);
    toast.success(`${done} question${done === 1 ? "" : "s"} added${result?.problems.length ? ` — ${result.problems.length} item${result.problems.length === 1 ? "" : "s"} needs your attention` : ""}`);
    setOpen(false);
    setResult(null); setRaw(""); setFile(""); setAdded(0);
    onDone();
  }

  return (
    <>
      <Button variant="outline" className="h-12 w-full border-dashed" onClick={() => setOpen(true)}>
        Import Questions — paste a list or upload a file
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setResult(null); setAdded(0); } }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import questions</DialogTitle>
            <DialogDescription>Paste your questions or upload a Word (.docx) or text (.txt) file. One question per block: the question, then options A, B, C… then the correct answer, then an optional Explanation: line.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Upload a file</Label>
              <input ref={pick} type="file" accept=".docx,.txt,.md,.csv,.text" multiple className="hidden"
                onChange={(e) => readFiles(e.target.files)} />
              <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => pick.current?.click()}>
                {busy ? "Reading..." : "Choose file(s)"}
              </Button>
              {file && <p className="text-xs text-muted-foreground">Read: {file}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Default marks per question</Label>
              <Input type="number" min={0.5} step={0.5} value={1} readOnly className="hidden" />
              <p className="rounded-xl bg-muted p-3 text-sm">
                Written as <span className="font-bold">[2 marks]</span> on a question line, that question gets 2 marks. Otherwise it gets 1.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="imp">Questions</Label>
            <Textarea id="imp" rows={12} value={raw} onChange={(e) => { setRaw(e.target.value); setResult(null); }}
              className="font-mono text-sm" placeholder={SAMPLE} />
            <button type="button" className="text-sm font-bold text-primary underline"
              onClick={() => { setRaw(SAMPLE); setResult(null); }}>Use this sample so I can see the format</button>
          </div>

          {!result && (
            <Button className="h-11" disabled={busy || !raw.trim()} onClick={() => setResult(parseQuestions(raw))}>
              Check my list
            </Button>
          )}

          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-success/15 p-3"><p className="text-2xl font-bold">{result.questions.length}</p><p className="text-sm">Ready to add</p></div>
                <div className="rounded-xl bg-muted p-3"><p className="text-2xl font-bold">{result.questions.filter((q) => q.type !== "mcq").length}</p><p className="text-sm">Not multiple choice</p></div>
                <div className="rounded-xl bg-warning/25 p-3"><p className="text-2xl font-bold">{result.problems.length}</p><p className="text-sm">Need attention</p></div>
              </div>
              {result.problems.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
                  {result.problems.slice(0, 40).map((p, i) => <p key={i}>• {p}</p>)}
                  {result.problems.length > 40 && <p className="font-bold">…and {result.problems.length - 40} more</p>}
                </div>
              )}
              <div className="max-h-60 overflow-y-auto rounded-xl border">
                {result.questions.map((q, i) => (
                  <div key={i} className="border-b p-3 last:border-0">
                    <p className="text-xs font-bold uppercase text-muted-foreground">{i + 1} · {q.type === "mcq" ? "Multiple choice" : q.type === "true_false" ? "True/False" : "Short answer"} · {q.marks} mark{q.marks === 1 ? "" : "s"}</p>
                    <p className="mt-0.5 font-bold">{q.text}</p>
                    {q.options.length > 0 && <p className="mt-0.5 text-sm">{q.options.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join("   ")}</p>}
                    <p className="mt-0.5 text-sm text-success">Correct: {q.correct_answer}</p>
                    {q.explanation && <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">Explanation: {q.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <p className="text-sm text-muted-foreground">{added > 0 ? `${added} added` : `${parsed.length} ready to add`}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button className="min-w-40" disabled={busy || parsed.length === 0} onClick={addAll}>
                {busy ? "Adding..." : `Add ${parsed.length} question${parsed.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

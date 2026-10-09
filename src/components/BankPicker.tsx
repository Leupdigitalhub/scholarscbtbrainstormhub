import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/admin-data";

export const BANK_TABS = ["English", "Mathematics", "Physics", "Chemistry", "Biology"];

export function BankPicker({ testId, position, subject = "", onDone }: { testId: string; position: number; subject?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(BANK_TABS.includes(subject) ? subject : "English");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, { id: string; text: string; subject: string }>>({});
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["bank-questions"],
    enabled: open,
    queryFn: () => fetchAll((from, to) => supabase.from("bank_questions").select("*").order("created_at").range(from, to)),
  });
  const [range, setRange] = useState("");
  const subRows = (data ?? []).filter((x) => x.subject === sub);
  const rows = q ? subRows.filter((x) => x.text.toLowerCase().includes(q.toLowerCase())) : subRows;
  const list = Object.values(picked);

  function selectRange() {
    const nums = new Set<number>();
    for (const part of range.split(/[,\s]+/).filter(Boolean)) {
      const m = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) { toast.error(`Can't read "${part}"`); return; }
      let a = Number(m[1] ?? 0), b = m[2] ? Number(m[2]) : a;
      if (a > b) [a, b] = [b, a];
      for (let n = a; n <= b; n++) if (n >= 1 && n <= subRows.length) nums.add(n);
    }
    const sorted = [...nums].sort((x, y) => x - y);
    if (!sorted.length) { toast.error(`No matching numbers (1-${subRows.length})`); return; }
    setPicked((p) => { const n = { ...p }; sorted.forEach((k) => { const x = subRows[k - 1]; if (x) n[x.id] = x; }); return n; });
    toast.success(`${sorted.length} ${sub} questions selected`);
    setRange("");
  }

  function toggle(x: { id: string; text: string; subject: string }) {
    setPicked((p) => { const n = { ...p }; if (n[x.id]) delete n[x.id]; else n[x.id] = x; return n; });
  }
  async function add() {
    const byId = new Map((data ?? []).map((x) => [x.id, x]));
    let pos = position;
    const ins = list.map((p) => byId.get(p.id)!).map((b) => ({
      test_id: testId, subject: subject || b.subject, type: b.type, text: b.text, options: b.options,
      correct_answer: b.correct_answer, explanation: b.explanation, marks: b.marks, position: pos++,
    }));
    setBusy(true);
    const { error } = await supabase.from("questions").insert(ins);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ins.length} question${ins.length === 1 ? "" : "s"} added`);
    setPicked({}); setOpen(false); onDone();
  }

  return (
    <>
      <Button className="h-12 w-full" onClick={() => setOpen(true)}><Library className="mr-2 h-4 w-4" />Add Questions from Question Bank</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Pick from Question Bank</DialogTitle>
            <DialogDescription>Tick the questions you want. They appear in your list on the right.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {BANK_TABS.map((s) => (
              <Button key={s} size="sm" variant={s === sub ? "default" : "outline"} onClick={() => setSub(s)}>{s}</Button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_320px]">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
                {rows.length > 0 && rows.every((x) => picked[x.id])
                  ? <Button variant="outline" onClick={() => setPicked((p) => { const n = { ...p }; rows.forEach((x) => { delete n[x.id]; }); return n; })}>Deselect all</Button>
                  : <Button variant="outline" onClick={() => setPicked((p) => { const n = { ...p }; rows.forEach((x) => { n[x.id] = x; }); return n; })}>Select all</Button>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Numbers e.g. 1-29, 45-67, 70" value={range} onChange={(e) => setRange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") selectRange(); }} />
                <Button variant="outline" onClick={selectRange}>Select numbers</Button>
              </div>
              <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                {rows.map((x, i) => (
                  <label key={x.id} className="flex cursor-pointer gap-3 rounded-xl border bg-card p-3">
                    <Checkbox checked={!!picked[x.id]} onCheckedChange={() => toggle(x)} />
                    <div className="text-sm">
                      <p className="font-bold">{i + 1}. {x.text}</p>
                      {(x.options as string[]).length > 0 && <p className="text-muted-foreground">{(x.options as string[]).map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join("   ")}</p>}
                      <p className="text-success">Answer: {x.correct_answer}</p>
                    </div>
                  </label>
                ))}
                {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No {sub} questions in the bank yet. Import some on the Question Bank page.</p>}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">My list ({list.length})</p>
                {list.length > 0 && <Button size="sm" variant="outline" onClick={() => setPicked({})}>Clear all</Button>}
              </div>
              <div className="mt-2 max-h-[45vh] space-y-1 overflow-y-auto text-sm">
                {list.map((p, i) => (
                  <div key={p.id} className="flex justify-between gap-2 rounded-lg bg-card p-2">
                    <span>{i + 1}. <span className="text-xs text-muted-foreground">[{p.subject}]</span> {p.text.slice(0, 70)}</span>
                    <button className="text-destructive" onClick={() => toggle(p)}>✕</button>
                  </div>
                ))}
              </div>
              <Button className="mt-3 w-full" disabled={!list.length || busy} onClick={add}>
                {busy ? "Adding..." : `Add ${list.length} to test`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

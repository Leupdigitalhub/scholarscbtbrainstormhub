import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLists } from "@/lib/auth";

export type TestValues = {
  title: string; subject: string; class: string; instructions: string; attempts_allowed: number;
  duration_minutes: number; pass_percentage: number; start_at: string | null; end_at: string | null; show_results: boolean;
  shuffle_questions: boolean; shuffle_options: boolean; draw_count: number | null;
  multi_subject: boolean; per_subject_count: number; show_corrections: boolean; gift_message: string; gift_enabled: boolean;
};

const toLocal = (iso: string | null) => {
  if (!iso) return { d: "", t: "" };
  const dt = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, t: `${pad(dt.getHours())}:${pad(dt.getMinutes())}` };
};
const fromLocal = (d: string, t: string) => (d ? new Date(`${d}T${t || "00:00"}`).toISOString() : null);

export function TestForm({ initial, onSubmit, submitLabel, questionCount }: { initial?: Partial<TestValues>; onSubmit: (v: TestValues) => Promise<void> | void; submitLabel: string; questionCount?: number }) {
  const { data: lists } = useLists();
  const s = toLocal(initial?.start_at ?? null), e = toLocal(initial?.end_at ?? null);
  const [v, setV] = useState({
    title: initial?.title ?? "", subject: initial?.subject ?? "", class: initial?.class ?? "",
    instructions: initial?.instructions ?? "", duration_minutes: initial?.duration_minutes ?? 30,
    pass_percentage: initial?.pass_percentage ?? 50, show_results: initial?.show_results ?? true,
    attempts_allowed: initial?.attempts_allowed ?? 1,
    shuffle_questions: initial?.shuffle_questions ?? false,
    shuffle_options: initial?.shuffle_options ?? false,
    draw_count: initial?.draw_count == null ? "" : String(initial.draw_count),
    multi_subject: initial?.multi_subject ?? false,
    per_subject_count: String(initial?.per_subject_count ?? 20),
    show_corrections: initial?.show_corrections ?? false,
    gift_message: initial?.gift_message ?? "",
    gift_enabled: initial?.gift_enabled ?? true,
    sd: s.d, st: s.t, ed: e.d, et: e.t,
  });
  const [busy, setBusy] = useState(false);
  const up = (k: string) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((prev) => ({ ...prev, [k]: ev.target.value }));
  const drawn = !v.multi_subject && Number(v.draw_count) > 0 ? Number(v.draw_count) : null;
  const tooMany = drawn != null && questionCount != null && drawn > questionCount;

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (ev) => {
      ev.preventDefault();
      setBusy(true);
      await onSubmit({
        title: v.title.trim(), subject: v.multi_subject && !v.subject ? "UTME Combination" : v.subject, class: v.class === "__all" ? "" : v.class, instructions: v.instructions,
        duration_minutes: Number(v.duration_minutes) || 30, pass_percentage: Number(v.pass_percentage) || 50,
        attempts_allowed: Math.max(1, Number(v.attempts_allowed) || 1),
        shuffle_questions: v.shuffle_questions, shuffle_options: v.shuffle_options, draw_count: drawn,
        multi_subject: v.multi_subject, per_subject_count: Math.max(1, Number(v.per_subject_count) || 20),
        show_results: v.show_results, show_corrections: v.show_corrections, gift_enabled: v.gift_enabled, gift_message: v.gift_message.trim(), start_at: fromLocal(v.sd, v.st), end_at: fromLocal(v.ed, v.et),
      });
      setBusy(false);
    }}>
      <F label="Test Title" className="sm:col-span-2"><Input required value={v.title} onChange={up("title")} placeholder="Mathematics CBT Test 1" /></F>
      <F label="Subject">
        <Select value={v.subject} onValueChange={(x) => setV((prev) => ({ ...prev, subject: x }))}>
          <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
          <SelectContent>{(lists?.subjects ?? []).map((x) => <SelectItem key={x.id} value={x.name}>{x.name}</SelectItem>)}</SelectContent>
        </Select>
      </F>
      <F label="Class">
        <Select value={v.class || "__all"} onValueChange={(x) => setV((prev) => ({ ...prev, class: x }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All classes</SelectItem>
            {(lists?.classes ?? []).map((x) => <SelectItem key={x.id} value={x.name}>{x.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </F>
      <F label="Instructions" className="sm:col-span-2"><Textarea rows={3} value={v.instructions} onChange={up("instructions")} placeholder="Answer all questions." /></F>
      <F label="Duration (minutes)"><Input type="number" min={1} required value={v.duration_minutes} onChange={up("duration_minutes")} /></F>
      <F label="Passing Percentage"><Input type="number" min={0} max={100} required value={v.pass_percentage} onChange={up("pass_percentage")} /></F>
      <p className="self-end text-xs text-muted-foreground">Total questions and total marks are counted automatically from the questions you add.</p>
      <F label="Start Date (optional)"><Input type="date" value={v.sd} onChange={up("sd")} /></F>
      <F label="Start Time"><Input type="time" value={v.st} onChange={up("st")} /></F>
      <F label="End Date (optional)"><Input type="date" value={v.ed} onChange={up("ed")} /></F>
      <F label="End Time"><Input type="time" value={v.et} onChange={up("et")} /></F>

      <div className="space-y-4 rounded-2xl border bg-muted/40 p-4 sm:col-span-2">
        <div>
          <p className="font-bold">Subject Combination (UTME style)</p>
          <p className="text-sm text-muted-foreground">English is compulsory. Each student picks 3 from Mathematics, Physics, Chemistry and Biology.</p>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="ms" checked={v.multi_subject} onCheckedChange={(c) => setV((prev) => ({ ...prev, multi_subject: c }))} />
          <Label htmlFor="ms" className="cursor-pointer font-normal">Let students choose their subjects</Label>
        </div>
        {v.multi_subject && (
          <F label="Questions per choice subject">
            <Input type="number" min={1} value={v.per_subject_count} onChange={up("per_subject_count")} className="max-w-40" />
            <p className="text-sm text-muted-foreground">English: {(Number(v.per_subject_count) || 0) + 10} questions · Choice subjects: {Number(v.per_subject_count) || 0} each · Total: {(Number(v.per_subject_count) || 0) * 4 + 10} questions.</p>
          </F>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border bg-muted/40 p-4 sm:col-span-2">
        <div>
          <p className="font-bold">Question Order (JAMB style)</p>
          <p className="text-sm text-muted-foreground">Every student gets their own copy of the test. Nobody can copy from a neighbour.</p>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="sq" checked={v.shuffle_questions} onCheckedChange={(c) => setV((prev) => ({ ...prev, shuffle_questions: c }))} />
          <Label htmlFor="sq" className="cursor-pointer font-normal">Shuffle the question order for each student</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="so" checked={v.shuffle_options} onCheckedChange={(c) => setV((prev) => ({ ...prev, shuffle_options: c }))} />
          <Label htmlFor="so" className="cursor-pointer font-normal">Shuffle the answer options (A, B, C, D) for each student</Label>
        </div>
        {!v.multi_subject && <F label="Questions to give each student (leave empty to use all)">
          <Input type="number" min={1} value={v.draw_count} onChange={up("draw_count")} placeholder="e.g. 20" className="max-w-40" />
        </F>}
        {tooMany && <p className="text-sm font-bold text-destructive">This test has {questionCount} questions, so {drawn} cannot be drawn. Add more questions or lower this number.</p>}
        {!tooMany && drawn != null && questionCount != null && drawn < questionCount && (
          <p className="text-sm text-muted-foreground">Each student will get {drawn} questions chosen at random from your {questionCount}.</p>
        )}
        <p className="text-xs text-muted-foreground">The number of questions and total marks shown to students update automatically.</p>
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Switch checked={v.show_results} onCheckedChange={(c) => setV((prev) => ({ ...prev, show_results: c }))} id="sr" />
        <Label htmlFor="sr">Show results to students immediately after submitting</Label>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Switch checked={v.show_corrections} onCheckedChange={(c) => setV((prev) => ({ ...prev, show_corrections: c }))} id="sc" />
        <Label htmlFor="sc">Let students see what they got right and wrong (with correct answers) after submitting</Label>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Switch checked={v.gift_enabled} onCheckedChange={(c) => setV((prev) => ({ ...prev, gift_enabled: c }))} id="ge" />
        <Label htmlFor="ge">🎁 Show the surprise box to students after the camera starts</Label>
      </div>
      {v.gift_enabled && <F label="Surprise box message (shown before the first question)" className="sm:col-span-2">
        <Textarea rows={4} value={v.gift_message} onChange={up("gift_message")} placeholder="Take a deep breath — you've prepared well! Only your white sheet and pencil are allowed. You've got this! 🚀" />
        <p className="text-xs text-muted-foreground">Leave empty to show a friendly default message.</p>
      </F>}
      <div className="sm:col-span-2"><Button disabled={busy || (!v.subject && !v.multi_subject) || tooMany} className="h-11">{busy ? "Saving..." : submitLabel}</Button></div>
    </form>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}

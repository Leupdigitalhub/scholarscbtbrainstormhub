import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AiTutor } from "@/components/AiTutor";

export type CorrectionRow = { id: string; text: string; type: string; subject: string; options: (string | { text: string; value: string })[]; correct: string; answer: string; marks: number; explanation?: string };
type Row = CorrectionRow;

export function isRight(q: CorrectionRow): boolean | null {
  const ans = (q.answer ?? "").trim();
  if (q.type === "written") return null;
  if (!ans) return false;
  if (q.type === "short") return q.correct.split("|").some((x) => x.trim().toLowerCase() === ans.toLowerCase());
  return ans.toLowerCase() === q.correct.toLowerCase();
}

const letterText = (opts: Row["options"], l: string) => {
  const hit = opts.find((o) => typeof o === "object" && o.value === l);
  if (hit && typeof hit === "object") return hit.text;
  const i = l ? l.toUpperCase().charCodeAt(0) - 65 : -1;
  const o = i >= 0 && i < opts.length ? opts[i] : undefined;
  return o === undefined ? l : typeof o === "string" ? o : o.text;
};

export function Corrections({ attemptId }: { attemptId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-corrections", attemptId],
    queryFn: async () => ((await supabase.rpc("my_corrections", { _attempt_id: attemptId })).data ?? null) as Row[] | null,
  });
  if (isLoading || !data || data.length === 0) return null;
  return (
    <div className="mt-8 text-left">
      <h2 className="text-xl font-bold">Corrections</h2>
      <p className="text-sm text-muted-foreground">See what you got right and wrong.</p>
      <AiTutor attemptId={attemptId} />
      <div className="mt-3 space-y-3">
        {data.map((q, i) => {
          const isChoice = q.type === "mcq" || q.type === "true_false";
          const ans = (q.answer ?? "").trim();
          const ok = isRight(q);
          const yours = !ans ? "Not answered" : isChoice ? letterText(q.options, ans) : ans;
          const right = isChoice ? letterText(q.options, q.correct) : q.correct.split("|")[0];
          return (
            <div key={q.id} className={cn("rounded-2xl border-2 bg-card p-4", ok === true ? "border-success/60" : ok === false ? "border-destructive/50" : "border-border")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">Question {i + 1}{q.subject ? ` · ${q.subject}` : ""}</p>
                {ok === true && <span className="flex items-center gap-1 text-sm font-bold text-success"><Check className="h-4 w-4" />Correct</span>}
                {ok === false && <span className="flex items-center gap-1 text-sm font-bold text-destructive"><X className="h-4 w-4" />{ans ? "Wrong" : "Skipped"}</span>}
              </div>
              <p className="mt-1 whitespace-pre-wrap font-bold">{q.text}</p>
              <p className="mt-2 text-sm"><span className="text-muted-foreground">Your answer: </span>{yours}</p>
              {q.type !== "written" && ok !== true && <p className="text-sm font-bold text-success">Correct answer: {right}</p>}
              {q.explanation && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-primary/5 p-3 text-sm"><span className="font-bold text-primary">Explanation: </span>{q.explanation}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

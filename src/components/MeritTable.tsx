import { useQuery } from "@tanstack/react-query";
import { Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const medal = ["text-gold", "text-silver", "text-bronze"];

export function MeritTable({ testId, highlightMe = false, limit }: { testId?: string | null; highlightMe?: boolean; limit?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", testId ?? "all"],
    queryFn: async () => (await supabase.rpc("leaderboard", testId ? { _test_id: testId } : {})).data ?? [],
  });
  if (isLoading) return <p className="p-6 text-center text-muted-foreground">Loading rankings...</p>;
  const rows = (data ?? []).slice(0, limit ?? 500);
  if (rows.length === 0) return <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">No results yet. Rankings appear once exams are submitted.</p>;
  const top = rows.slice(0, 3);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {top.map((r, i) => (
          <div key={r.student_id} className={cn("relative overflow-hidden rounded-2xl border-2 bg-card p-5 text-center", i === 0 ? "border-gold sm:order-2 sm:-translate-y-2" : i === 1 ? "border-silver sm:order-1" : "border-bronze sm:order-3")}>
            <Medal className={cn("mx-auto h-10 w-10", medal[i])} />
            <p className="mt-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">{["Gold", "Silver", "Bronze"][i]}</p>
            <p className="mt-1 truncate text-lg font-extrabold">{r.full_name}{r.is_me && highlightMe ? " (You)" : ""}</p>
            <p className="text-sm text-muted-foreground">{r.class || "—"}</p>
            <p className="mt-2 font-display text-3xl font-extrabold">{Number(r.percent)}%</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-muted"><tr><th className="p-3">Rank</th><th className="p-3">Student</th><th className="p-3">Class</th><th className="p-3">Exams</th><th className="p-3">Score</th><th className="p-3">Average</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.student_id} className={cn("border-t", highlightMe && r.is_me && "bg-primary/10 font-bold")}>
                <td className="p-3">{i < 3 ? <Medal className={cn("h-5 w-5", medal[i])} /> : <span className="font-bold text-muted-foreground">{i + 1}</span>}</td>
                <td className="p-3 font-bold">{r.full_name}{highlightMe && r.is_me ? " (You)" : ""}</td>
                <td className="p-3">{r.class || "—"}</td>
                <td className="p-3">{Number(r.tests_taken)}</td>
                <td className="p-3">{Number(r.total_score)}/{Number(r.total_marks)}</td>
                <td className="p-3 font-bold">{Number(r.percent)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pct } from "@/lib/auth";

// The database hands back at most 1000 rows per request, so anything that can
// grow past that (question banks, results) has to be read a page at a time.
export async function fetchAll<T = Record<string, unknown>>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  step = 500,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += step) {
    const { data, error } = await build(from, from + step - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < step) return out;
  }
}

export function useAdminResults() {
  return useQuery({
    queryKey: ["admin-results"],
    queryFn: async () => {
      const [a, p, t] = await Promise.all([
        supabase.from("attempts").select("*").order("started_at", { ascending: false }),
        supabase.from("profiles").select("*"),
        supabase.from("tests").select("id,title,class,subject,pass_percentage"),
      ]);
      const prof = new Map((p.data ?? []).map((x) => [x.id, x]));
      const tests = new Map((t.data ?? []).map((x) => [x.id, x]));
      return (a.data ?? []).map((x) => {
        const s = prof.get(x.student_id);
        const test = tests.get(x.test_id);
        const percent = pct(x.score, x.total);
        return {
          ...x,
          student_name: s?.full_name ?? "Unknown",
          student_code: s?.student_id ?? "",
          student_class: s?.class ?? "",
          test_title: test?.title ?? "",
          subject: test?.subject ?? "",
          percent,
          passed: percent >= (test?.pass_percentage ?? 50),
        };
      });
    },
  });
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

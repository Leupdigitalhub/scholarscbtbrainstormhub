import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv, useAdminResults } from "@/lib/admin-data";
import { gradeFor, useSettings } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/results/")({
  component: Results,
});

function Results() {
  const { data } = useAdminResults();
  const [q, setQ] = useState("");
  const [test, setTest] = useState("all");
  const [cls, setCls] = useState("all");
  const [subj, setSubj] = useState("all");
  const { data: settings } = useSettings();
  const g = (p: number) => gradeFor(p, settings?.grade_scale);
  const all = data ?? [];
  const tests = [...new Map(all.map((r) => [r.test_id, r.test_title])).entries()];
  const subjects = [...new Set(all.map((r) => r.subject).filter(Boolean))];
  const classes = [...new Set(all.map((r) => r.student_class).filter(Boolean))];
  const rows = all.filter((r) =>
    (test === "all" || r.test_id === test) && (cls === "all" || r.student_class === cls) && (subj === "all" || r.subject === subj) &&
    `${r.student_name} ${r.student_code}`.toLowerCase().includes(q.toLowerCase()));

  const status = (r: (typeof rows)[number]) => r.status !== "submitted" ? "In progress" : r.pending_grading ? "Needs marking" : r.passed ? "Passed" : "Failed";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Results</h1>
        <Button variant="outline" onClick={() => downloadCsv("results.csv", [
          ["Student", "Student ID", "Class", "Test", "Score", "Total", "Percentage", "Grade", "Status", "Submitted"],
          ...rows.map((r) => [r.student_name, r.student_code, r.student_class, r.test_title, r.score, r.total, `${r.percent}%`, g(r.percent), status(r), r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ""]),
        ])}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search student..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={test} onValueChange={setTest}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All tests</SelectItem>{tests.map(([id, t]) => <SelectItem key={id} value={id}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subj} onValueChange={setSubj}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All classes</SelectItem>{classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted"><tr><th className="p-3">Student</th><th className="p-3">Class</th><th className="p-3">Test</th><th className="p-3">Score</th><th className="p-3">%</th><th className="p-3">Grade</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const s = status(r);
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-bold">{r.student_name}<div className="text-xs font-normal text-muted-foreground">{r.student_code}</div></td>
                  <td className="p-3">{r.student_class}</td><td className="p-3">{r.test_title}</td>
                  <td className="p-3">{r.score}/{r.total}</td><td className="p-3">{r.percent}%</td><td className="p-3 font-bold">{g(r.percent)}</td>
                  <td className={`p-3 font-bold ${s === "Passed" ? "text-success" : s === "Failed" ? "text-destructive" : "text-muted-foreground"}`}>{s}</td>
                  <td className="p-3"><Link to="/admin/results/$attemptId" params={{ attemptId: r.id }} className="font-bold text-primary">View</Link></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No results yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

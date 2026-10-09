import { createFileRoute } from "@tanstack/react-router";
import { StudentShell } from "@/components/StudentShell";
import { MeritTable } from "@/components/MeritTable";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — SCHOLARS CBT" }, { name: "description", content: "See the top-performing SCHOLARS CBT students." }] }),
  component: () => (
    <StudentShell>
      <h1 className="text-3xl font-extrabold">Leaderboard</h1>
      <p className="mb-6 text-muted-foreground">Ranked by average score across all released exams.</p>
      <MeritTable highlightMe />
    </StudentShell>
  ),
});

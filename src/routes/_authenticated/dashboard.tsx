import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { BookOpen, CalendarClock, Clock, FileQuestion, GraduationCap, ShieldCheck } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { Announcements } from "@/components/Announcements";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — SCHOLARS CBT" }] }),
  component: Dashboard,
});

const SPARKS = [
  "Your brain grows stronger every time you solve a hard question.",
  "Teach a topic to a friend — explaining is the fastest way to remember.",
  "Short, daily practice beats one long night of cramming.",
  "Mistakes are lessons: read every correction and explanation.",
  "Sleep well before exams — memory is built while you rest.",
  "Curiosity is a scholar's superpower. Ask 'why?' today.",
];
function Dashboard() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  useEffect(() => { if (me?.isAdmin) navigate({ to: "/admin" }); }, [me, navigate]);
  const tests = useQuery({ queryKey: ["student-tests"], queryFn: async () => (await supabase.rpc("student_tests")).data ?? [] });
  const results = useQuery({ queryKey: ["my-results"], queryFn: async () => (await supabase.rpc("my_results")).data ?? [] });
  const now = Date.now();
  const all = tests.data ?? [];
  const res = results.data ?? [];
  const submitted = res.filter((r) => r.status === "submitted");
  const inProgress = new Set(res.filter((r) => r.status === "in_progress").map((r) => r.test_id));

  const upcoming = all.filter((t) => t.start_at && new Date(t.start_at).getTime() > now);
  const available = all.filter((t) =>
    !upcoming.includes(t) && !(t.end_at && new Date(t.end_at).getTime() < now));
  const completedIds = new Set(submitted.map((r) => r.test_id));
  const completed = all.filter((t) => completedIds.has(t.id) && !available.includes(t));

  const name = me?.profile?.full_name || "Student";
  return (
    <StudentShell>
      <div className="overflow-hidden rounded-2xl border-2 border-primary bg-card shadow-sm">
        <div className="flex items-center justify-between bg-primary px-5 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground">
          <span>Candidate Slip</span><span>{new Date().toLocaleDateString([], { dateStyle: "medium" })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-accent font-display text-2xl font-extrabold text-accent-foreground">{name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold">{name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-5 text-sm text-muted-foreground">
              {me?.profile?.class && <span>Class: <b className="text-foreground">{me.profile.class}</b></span>}
              {me?.profile?.student_id && <span>Reg No: <b className="text-foreground">{me.profile.student_id}</b></span>}
            </div>
          </div>
          <span className="rounded-full bg-success px-3 py-1 text-xs font-bold uppercase text-success-foreground">Eligible</span>
        </div>
        <div className="grid grid-cols-3 border-t text-center">
          <Stat n={available.length} l="Available" />
          <Stat n={upcoming.length} l="Upcoming" />
          <Stat n={submitted.length} l="Completed" />
        </div>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-2xl text-primary-foreground shadow-sm">
        <img src="https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=70" alt="Science laboratory" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 to-primary/50" />
        <div className="relative p-5">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Brain Spark</p>
          <p className="mt-1 max-w-lg font-display text-lg font-bold">{SPARKS[new Date().getDate() % SPARKS.length]}</p>
        </div>
      </div>

      <Announcements />

      <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <Section title="Available Examinations" empty="No examinations available right now.">
            {available.map((t) => (
              <TestCard key={t.id} t={t}>
                <Button asChild className="h-12 w-full bg-success text-base text-success-foreground hover:bg-success/90 sm:w-auto sm:px-8">
                  <Link to="/test/$testId" params={{ testId: t.id }}>{inProgress.has(t.id) ? "Continue CBT" : "Start CBT"}</Link>
                </Button>
              </TestCard>
            ))}
          </Section>

          <Section title="Exam Timetable" empty="No upcoming examinations.">
            {upcoming.map((t) => (
              <TestCard key={t.id} t={t}>
                <span className="flex items-center gap-1 rounded-lg bg-muted px-3 py-2 text-sm font-bold"><CalendarClock className="h-4 w-4" />Opens {new Date(t.start_at!).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
              </TestCard>
            ))}
          </Section>
        </div>

        <aside className="space-y-4 lg:pt-8">
          <Link to="/syllabus" className="block overflow-hidden rounded-2xl border bg-card p-4 transition hover:bg-muted">
            <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=70" alt="Books and study" loading="lazy" className="-mx-4 -mt-4 mb-3 h-28 w-[calc(100%+2rem)] max-w-none object-cover" />
            <p className="flex items-center gap-2 font-bold"><BookOpen className="h-5 w-5 text-primary" />SS1–SS3 Study Topics</p>
            <p className="mt-1 text-sm text-muted-foreground">Track the topics you have studied.</p>
            <p className="mt-2 text-sm font-bold text-primary">Open syllabus →</p>
          </Link>
          <div className="rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-primary" />Exam Rules</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Camera must stay on throughout.</li>
              <li>Only a white sheet and pencil allowed.</li>
              <li>No phones, earpieces or smart watches.</li>
              <li>Do not leave the exam tab.</li>
            </ul>
          </div>
          {completed.length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <p className="font-bold">Completed</p>
              <div className="mt-2 space-y-2">
                {completed.map((t) => {
                  const last = submitted.find((r) => r.test_id === t.id)!;
                  return <Link key={t.id} to="/result/$attemptId" params={{ attemptId: last.attempt_id }} className="block rounded-lg bg-muted px-3 py-2 text-sm font-bold hover:bg-accent">{t.title} →</Link>;
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </StudentShell>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <>
      <h2 className="mt-8 text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3">
        {children.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">{empty}</p> : children}
      </div>
    </>
  );
}

type T = { id: string; title: string; subject: string; class: string; question_count: number; duration_minutes: number };
function TestCard({ t, children }: { t: T; children: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="flex items-center gap-2 text-lg font-bold"><GraduationCap className="h-5 w-5 text-primary" />{t.title}</h3>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span>Subject: {t.subject}</span>
        {t.class && <span>Class: {t.class}</span>}
        <span className="flex items-center gap-1"><FileQuestion className="h-4 w-4" />{t.question_count} questions</span>
        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{t.duration_minutes} minutes</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div className="border-r p-3 last:border-r-0"><p className="font-display text-2xl font-extrabold text-primary">{n}</p><p className="text-xs font-bold uppercase text-muted-foreground">{l}</p></div>;
}

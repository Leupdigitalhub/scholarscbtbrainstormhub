import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Atom, BookOpen, Dumbbell, GraduationCap, LayoutDashboard, LogOut, Menu, PlayCircle, Settings, Trophy, X, FileBarChart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HallWatermark } from "@/components/HallWatermark";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/exams", label: "Start Exam", icon: PlayCircle },
  { to: "/results", label: "My Results", icon: FileBarChart },
  { to: "/practice", label: "Practice", icon: Dumbbell },
  { to: "/syllabus", label: "Study Guide", icon: BookOpen },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/science", label: "Global Science", icon: Atom },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function StudentShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  const name = me?.profile?.full_name || "Student";

  const side = (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" className="flex items-center gap-3 px-5 py-5" onClick={() => setOpen(false)}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground"><GraduationCap className="h-7 w-7" /></span>
        <span className="leading-tight">
          <span className="block font-display text-lg font-extrabold tracking-wide">SCHOLARS CBT</span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-70">Student Portal</span>
        </span>
      </Link>
      <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground">{name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 text-sm">
          <p className="truncate font-bold">{name}</p>
          <p className="truncate text-xs opacity-70">{me?.profile?.class || "Student"}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold opacity-85 transition hover:bg-sidebar-accent hover:opacity-100"
            activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground opacity-100 hover:bg-sidebar-primary" }}>
            <n.icon className="h-4 w-4" />{n.label}
          </Link>
        ))}
      </nav>
      <button onClick={signOut} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-sidebar-accent">
        <LogOut className="h-4 w-4" />Log out
      </button>
    </div>
  );

  return (
    <div className="relative min-h-screen lg:flex">
      <HallWatermark />
      <aside className="relative z-20 hidden bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0">{side}</aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-2.5 font-display text-lg font-extrabold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent"><GraduationCap className="h-5 w-5" /></span>SCHOLARS CBT</Link>
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-sidebar-accent"><Menu className="h-5 w-5" /></button>
      </header>
      <div className={cn("fixed inset-0 z-30 lg:hidden", open ? "" : "pointer-events-none")}>
        <div className={cn("absolute inset-0 bg-foreground/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside className={cn("absolute inset-y-0 left-0 w-72 bg-sidebar text-sidebar-foreground shadow-xl transition-transform", open ? "translate-x-0" : "-translate-x-full")}>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-lg p-1.5 hover:bg-sidebar-accent"><X className="h-5 w-5" /></button>
          {side}
        </aside>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

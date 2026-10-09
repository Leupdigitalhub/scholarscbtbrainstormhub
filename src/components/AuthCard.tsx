import { Link } from "@tanstack/react-router";
import { BookOpenCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="min-h-screen px-5 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2 text-primary">
          <BookOpenCheck className="h-6 w-6" />
          <span className="font-display font-bold">Home</span>
        </Link>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

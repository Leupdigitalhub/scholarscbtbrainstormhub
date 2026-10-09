import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "@/components/LoginForm";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Student Login — SCHOLARS CBT" },
      { name: "description", content: "Log in to see and take your available tests." },
      { property: "og:title", content: "Student Login" },
      { property: "og:description", content: "Log in to see and take your available tests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AuthCard title="Student Login" subtitle="Welcome back! Log in to take your test.">
      <LoginForm mode="student" />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        New here? <Link to="/register" className="font-bold text-primary">Create Account</Link>
      </p>
    </AuthCard>
  ),
});

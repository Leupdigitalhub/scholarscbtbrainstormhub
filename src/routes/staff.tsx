import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { toast } from "sonner";
import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "@/components/LoginForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff Sign In" },
      { name: "description", content: "Private administrator sign in." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Staff Sign In" },
      { property: "og:description", content: "Private administrator sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: Staff,
});

function Staff() {
  const { data: exists, isLoading } = useQuery({
    queryKey: ["admin-exists"],
    queryFn: async () => (await supabase.rpc("admin_exists")).data ?? true,
  });
  if (isLoading) return null;
  if (!exists) return <Setup />;
  return (
    <AuthCard title="Administrator Login" subtitle="Private teacher access.">
      <LoginForm mode="admin" />
    </AuthCard>
  );
}

function Setup() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let { data, error } = await supabase.auth.signUp({ email: f.email.trim(), password: f.password, options: { data: { full_name: f.name } } });
    if (error) { setBusy(false); { toast.error(error.message); return; } }
    if (!data.session) {
      const r = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
      if (r.error) { setBusy(false); { toast.error(r.error.message); return; } }
    }
    const c = await supabase.rpc("claim_admin");
    setBusy(false);
    if (c.error) { toast.error(c.error.message); return; }
    toast.success("Administrator account created");
    navigate({ to: "/admin" });
  }
  return (
    <AuthCard title="Set up administrator" subtitle="One-time setup. Once created, this option disappears forever.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label>Your name</Label><Input required value={f.name} onChange={(e) => setF((prev) => ({ ...prev, name: e.target.value }))} className="h-12" /></div>
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={f.email} onChange={(e) => setF((prev) => ({ ...prev, email: e.target.value }))} className="h-12" /></div>
        <div className="space-y-1.5"><Label>Password</Label><Input type="password" minLength={8} required value={f.password} onChange={(e) => setF((prev) => ({ ...prev, password: e.target.value }))} className="h-12" /></div>
        <Button disabled={busy || !hydrated} className="h-12 w-full">{busy ? "Creating..." : "Create administrator"}</Button>
      </form>
    </AuthCard>
  );
}

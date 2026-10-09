import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useHydrated } from "@/lib/use-hydrated";
import { useState } from "react";
import { toast } from "sonner";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useLists } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Student Account — SCHOLARS CBT" },
      { name: "description", content: "Register as a student to take your online lesson tests." },
      { property: "og:title", content: "Create Student Account" },
      { property: "og:description", content: "Register as a student to take your online lesson tests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const { data: lists } = useLists();
  const [f, setF] = useState({ full_name: "", student_id: "", phone: "", email: "", password: "", confirm: "", class: "" });
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (!f.class) { toast.error("Please choose your class"); return; }
    if (f.password !== f.confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: f.full_name.trim(), student_id: f.student_id.trim(), phone: f.phone.trim(), class: f.class.trim() },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data.session) { toast.success("Account created. Please log in."); return; }
    navigate({ to: "/dashboard" });
  }

  const fields: [keyof typeof f, string, string][] = [
    ["full_name", "Full Name", "text"],
    ["phone", "Phone Number", "tel"],
    ["email", "Email", "email"],
    ["password", "Password", "password"],
    ["confirm", "Confirm Password", "password"],
  ];
  return (
    <AuthCard title="Create Student Account" subtitle="Fill in your details to get started.">
      <form onSubmit={submit} className="space-y-4">
        {fields.map(([k, label, type]) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={k}>{label}</Label>
            <Input id={k} type={type} required value={f[k]} onChange={set(k)} className="h-12 text-base" />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={f.class} onValueChange={(v) => setF((prev) => ({ ...prev, class: v }))}>
            <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Choose your class" /></SelectTrigger>
            <SelectContent>{(lists?.classes ?? []).map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy || !hydrated} className="h-12 w-full text-base">
          {busy ? "Creating..." : "Create Account"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="font-bold text-primary">Log in</Link>
        </p>
      </form>
    </AuthCard>
  );
}

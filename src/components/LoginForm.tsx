import { useNavigate } from "@tanstack/react-router";
import { useHydrated } from "@/lib/use-hydrated";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getIsAdmin } from "@/lib/auth";

export function LoginForm({ mode }: { mode: "student" | "admin" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();

  async function resolveEmail(v: string) {
    const t = v.trim();
    if (t.includes("@")) return t;
    const { data } = await supabase.rpc("email_for_student_id", { _sid: t });
    return (data as string | null) || null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const addr = await resolveEmail(email);
    if (!addr) { setBusy(false); toast.error("No student found with that ID."); return; }
    const { data, error } = await supabase.auth.signInWithPassword({ email: addr, password });
    if (error) {
      setBusy(false);
      { toast.error(error.message); return; }
    }
    const admin = await getIsAdmin(data.user.id);
    setBusy(false);
    if (mode === "admin" && !admin) {
      await supabase.auth.signOut();
      { toast.error("This account is not an administrator."); return; }
    }
    if (!admin) void supabase.rpc("log_student_login");
    navigate({ to: admin ? "/admin" : "/dashboard" });
  }

  async function forgot() {
    if (!email.trim()) { toast.error("Type your email or Student ID above first, then tap Forgot password."); return; }
    const addr = await resolveEmail(email);
    if (!addr) { toast.error("No student found with that ID."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) { toast.error(error.message); return; }
    toast.success("Check your email for a link to reset your password.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{mode === "student" ? "Email or Student ID" : "Email"}</Label>
        <Input id="email" type={mode === "student" ? "text" : "email"} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={mode === "student" ? "Email / Student ID (e.g. SCHCBT0001)" : ""} autoCapitalize="none" className="h-12 text-base" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-base" />
        {mode === "student" && (
          <button type="button" onClick={forgot} className="text-sm font-bold text-primary hover:underline">Forgot password?</button>
        )}
      </div>
      <Button type="submit" disabled={busy || !hydrated} className="h-12 w-full text-base">
        {busy ? "Signing in..." : "Log In"}
      </Button>
    </form>
  );
}

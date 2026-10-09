import { useNavigate } from "@tanstack/react-router";
import { useHydrated } from "@/lib/use-hydrated";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getIsAdmin } from "@/lib/auth";

export function LoginForm({ mode }: { mode: "student" | "admin" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const hydrated = useHydrated();

  async function signInWithGoogle() {
    setGoogleBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleBusy(false);
      toast.error(result.error.message);
      return;
    }
    if (result.redirected) {
      // Browser is heading to Google — the app home page finishes the redirect after sign-in.
      return;
    }
    const admin = await getIsAdmin(result.tokens.user.id);
    setGoogleBusy(false);
    navigate({ to: admin ? "/admin" : "/dashboard" });
  }

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
    if (!email.trim()) { toast.error("Type your email or STUDENT ID above first, then tap Forgot password."); return; }
    const addr = await resolveEmail(email);
    if (!addr) { toast.error("No student found with that ID."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) { toast.error(error.message); return; }
    toast.success("Check your email for a link to reset your password.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{mode === "student" ? "Email or STUDENT ID" : "Email"}</Label>
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
      {mode === "student" && (
        <>
          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" disabled={googleBusy || !hydrated} onClick={signInWithGoogle} className="h-12 w-full text-base">
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6z" />
              <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5l-3.9 3C3.3 21.3 7.3 24 12 24z" />
              <path fill="#FBBC05" d="M5.1 14.4c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-3.9-3C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l3.9-3z" />
              <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C16.9 1 14.2 0 12 0 7.3 0 3.3 2.7 1.2 6.6l3.9 3c1-2.9 3.7-4.9 6.9-4.9z" />
            </svg>
            {googleBusy ? "Opening Google..." : "Continue with Google"}
          </Button>
        </>
      )}
    </form>
  );
}

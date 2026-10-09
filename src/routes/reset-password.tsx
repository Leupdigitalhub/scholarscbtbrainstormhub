import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — SCHOLARS CBT" },
      { name: "description", content: "Choose a new password for your SCHOLARS CBT account." },
      { property: "og:title", content: "Reset Password — SCHOLARS CBT" },
      { property: "og:description", content: "Choose a new password for your SCHOLARS CBT account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    if (pw !== pw2) { toast.error("Passwords do not match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message.includes("session") ? "This reset link has expired. Request a new one from the login page." : error.message); return; }
    toast.success("Password updated. You are now signed in.");
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthCard title="Set New Password" subtitle="Type your new password below.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} className="h-12 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw2">Confirm new password</Label>
          <Input id="pw2" type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-12 text-base" />
        </div>
        <Button type="submit" disabled={busy} className="h-12 w-full text-base">{busy ? "Saving..." : "Save Password"}</Button>
      </form>
    </AuthCard>
  );
}

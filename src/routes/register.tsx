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
import { SelfieCapture } from "@/components/SelfieCapture";
import { PasswordInput } from "@/components/PasswordInput";
import { makeStudentId, uploadAvatar, savePendingAvatar } from "@/lib/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [f, setF] = useState({ full_name: "", phone: "", email: "", password: "", confirm: "", class: "" });
  const [busy, setBusy] = useState(false);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [welcome, setWelcome] = useState<{ id: string; go: boolean } | null>(null);
  const hydrated = useHydrated();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (!f.class) { toast.error("Please choose your class"); return; }
    if (f.password !== f.confirm) { toast.error("Passwords do not match"); return; }
    if (!selfie) { toast.error("Please take your face photo first"); return; }
    setBusy(true);
    let sid = makeStudentId();
    for (let i = 0; i < 6; i++) {
      const { data: taken } = await supabase.rpc("email_for_student_id", { _sid: sid });
      if (!taken) break;
      sid = makeStudentId();
    }
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: f.full_name.trim(), student_id: sid, phone: f.phone.trim(), class: f.class.trim() },
      },
    });
    if (error) { setBusy(false); toast.error(error.message); return; }
    if (data.session && data.user) { if (!(await uploadAvatar(data.user.id, selfie))) await savePendingAvatar(f.email.trim(), selfie); }
    else await savePendingAvatar(f.email.trim(), selfie);
    setBusy(false);
    setWelcome({ id: sid, go: !!data.session });
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
            {type === "password" ? <PasswordInput id={k} required value={f[k]} onChange={set(k)} className="h-12 text-base" /> : <Input id={k} type={type} required value={f[k]} onChange={set(k)} className="h-12 text-base" />}
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={f.class} onValueChange={(v) => setF((prev) => ({ ...prev, class: v }))}>
            <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Choose your class" /></SelectTrigger>
            <SelectContent>{(lists?.classes ?? []).map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Your face photo</Label>
          <p className="text-xs text-muted-foreground">Take a clear live selfie. It becomes your profile photo and is used to confirm it is you during exams.</p>
          <SelfieCapture onChange={setSelfie} />
        </div>
        <Button type="submit" disabled={busy || !hydrated} className="h-12 w-full text-base">
          {busy ? "Creating..." : "Create Account"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="font-bold text-primary">Log in</Link>
        </p>
      </form>
      <Dialog open={!!welcome} onOpenChange={() => {}}>
        <DialogContent className="text-center" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-extrabold">Welcome to SCHOLARS CBT! 🎉</DialogTitle>
            <DialogDescription className="text-center">Your account is ready. This is your STUDENT ID — write it down. You will use it to log in to every exam.</DialogDescription>
          </DialogHeader>
          <p className="my-2 rounded-2xl border-4 border-primary bg-primary/10 py-4 font-mono text-4xl font-extrabold tracking-widest text-primary">{welcome?.id}</p>
          <Button className="h-12 w-full" onClick={() => { void navigator.clipboard?.writeText(welcome?.id ?? "").then(() => toast.success("Copied")); }} variant="outline">Copy STUDENT ID</Button>
          <Button className="h-12 w-full" onClick={() => navigate({ to: welcome?.go ? "/dashboard" : "/login" })}>
            {welcome?.go ? "I have saved it — go to my dashboard" : "I have saved it — log in"}
          </Button>
          {!welcome?.go && <p className="text-xs text-muted-foreground">Check your email to confirm your account first.</p>}
        </DialogContent>
      </Dialog>
    </AuthCard>
  );
}

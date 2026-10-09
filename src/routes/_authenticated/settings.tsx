import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StudentShell } from "@/components/StudentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SCHOLARS CBT" }, { name: "description", content: "Your account settings." }] }),
  component: Settings,
});

function Settings() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (me?.profile) { setName(me.profile.full_name ?? ""); setPhone(me.profile.phone ?? ""); } }, [me]);

  async function saveProfile() {
    if (!me) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), phone: phone.trim() }).eq("id", me.user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["me"] });
    toast.success("Profile saved");
  }
  async function savePw() {
    if (pw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPw("");
    toast.success("Password changed");
  }

  return (
    <StudentShell>
      <h1 className="text-3xl font-extrabold">Settings</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="font-bold">My profile</h2>
          <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={me?.user.email ?? ""} disabled /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Class</Label><Input value={me?.profile?.class ?? ""} disabled /></div>
            <div><Label>Reg No</Label><Input value={me?.profile?.student_id ?? ""} disabled /></div>
          </div>
          <Button disabled={busy} onClick={saveProfile}>Save profile</Button>
        </div>
        <div className="space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="font-bold">Change password</h2>
          <div><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <Button disabled={busy} onClick={savePw}>Update password</Button>
          <p className="text-sm text-muted-foreground">Class and Reg No can only be changed by your school admin.</p>
        </div>
      </div>
    </StudentShell>
  );
}

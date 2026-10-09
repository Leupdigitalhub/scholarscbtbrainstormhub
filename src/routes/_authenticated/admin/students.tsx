import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAdminResults } from "@/lib/admin-data";
import { deleteStudent } from "@/lib/students.functions";

export const Route = createFileRoute("/_authenticated/admin/students")({
  component: Students,
});

function Students() {
  const [q, setQ] = useState("");
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const remove = useServerFn(deleteStudent);
  const { data } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const [roles, profiles] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      const admins = new Set((roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (profiles.data ?? []).filter((p) => !admins.has(p.id));
    },
  });
  const results = useAdminResults();
  const rows = (data ?? []).filter((s) => `${s.full_name} ${s.student_id} ${s.class} ${s.email} ${s.phone}`.toLowerCase().includes(q.toLowerCase()));

  async function confirmDelete() {
    if (!del) return;
    setBusy(true);
    try {
      await remove({ data: { studentId: del.id } });
      toast.success(`${del.name || "Student"} was deleted`);
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete student");
    }
    setBusy(false);
    setDel(null);
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Students</h1>
      <Input className="mt-4 max-w-sm" placeholder="Search by name, ID or class..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted"><tr><th className="p-3">Name</th><th className="p-3">Student ID</th><th className="p-3">Class</th><th className="p-3">Contact</th><th className="p-3">Tests taken</th><th className="p-3">Average</th><th className="p-3"></th></tr></thead>
          <tbody>
            {rows.map((s) => {
              const mine = (results.data ?? []).filter((r) => r.student_id === s.id && r.status === "submitted");
              const avg = mine.length ? Math.round(mine.reduce((a, r) => a + r.percent, 0) / mine.length) : null;
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-bold">{s.full_name}</td><td className="p-3">{s.student_id}</td><td className="p-3">{s.class}</td>
                  <td className="p-3">{s.email}<div className="text-xs text-muted-foreground">{s.phone}</div></td><td className="p-3">{mine.length}</td><td className="p-3">{avg === null ? "—" : `${avg}%`}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDel({ id: s.id, name: s.full_name })}>
                      <Trash2 className="mr-1 h-4 w-4" />Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No students yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {del?.name || "this student"}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes their account, profile, exam attempts and results. It cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); void confirmDelete(); }}>
              {busy ? "Deleting..." : "Delete student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

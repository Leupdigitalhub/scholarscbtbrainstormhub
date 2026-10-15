import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function makeCode() {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  const n = String(a[0]! % 10000).padStart(4, "0");
  const m = String(a[1]! % 10000).padStart(4, "0");
  return `SCH-${n}-${m}`;
}

/** Admin: generate, track, copy and delete access PINs. */
export function PinManager() {
  const qc = useQueryClient();
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const pins = useQuery({
    queryKey: ["access-pins"],
    queryFn: async () => (await supabase.from("access_pins").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const names = useQuery({
    enabled: !!pins.data,
    queryKey: ["pin-names", pins.data?.length],
    queryFn: async () => {
      const ids = [...new Set((pins.data ?? []).map((p) => p.redeemed_by).filter((x): x is string => !!x))];
      if (!ids.length) return new Map<string, string>();
      const { data } = await supabase.from("profiles").select("id,full_name,student_id").in("id", ids);
      return new Map((data ?? []).map((p) => [p.id, `${p.full_name} (${p.student_id})`]));
    },
  });
  const fresh = (pins.data ?? []).filter((p) => !p.redeemed_by);

  async function generate() {
    const n = Math.min(Math.max(1, count), 200);
    setBusy(true);
    const rows = Array.from({ length: n }, () => ({ code: makeCode() }));
    const { error } = await supabase.from("access_pins").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${n} PINs created`);
    void qc.invalidateQueries({ queryKey: ["access-pins"] });
  }
  const copy = (t: string) => { void navigator.clipboard.writeText(t); toast.success("Copied"); };

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="text-lg font-bold">Access PINs</h2>
      <p className="text-sm text-muted-foreground">Sell a PIN to a student; once they enter it, full exams unlock on their account. Each PIN works once.</p>
      <PinSwitch />
      <div className="mt-3 flex flex-wrap gap-2">
        <Input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-24" />
        <Button onClick={generate} disabled={busy}>Generate PINs</Button>
        <Button variant="outline" disabled={!fresh.length} onClick={() => copy(fresh.map((p) => p.code).join("\n"))}>
          <Copy className="mr-2 h-4 w-4" />Copy all unused ({fresh.length})
        </Button>
      </div>
      <div className="mt-4 max-h-96 overflow-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-2">PIN</th><th className="p-2">Status</th><th className="p-2">Used by</th><th className="p-2"></th></tr></thead>
          <tbody>
            {(pins.data ?? []).map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2 font-mono font-bold">{p.code}</td>
                <td className="p-2">{p.redeemed_by
                  ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Used {p.redeemed_at ? new Date(p.redeemed_at).toLocaleDateString() : ""}</span>
                  : <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">Active</span>}</td>
                <td className="p-2 text-xs">{p.redeemed_by ? names.data?.get(p.redeemed_by) ?? "Student" : "—"}</td>
                <td className="p-2 text-right">
                  {!p.redeemed_by && <>
                    <button aria-label="Copy PIN" className="mr-2 text-primary" onClick={() => copy(p.code)}><Copy className="h-4 w-4" /></button>
                    <button aria-label="Delete PIN" className="text-destructive" onClick={async () => {
                      await supabase.from("access_pins").delete().eq("id", p.id);
                      void qc.invalidateQueries({ queryKey: ["access-pins"] });
                    }}><Trash2 className="h-4 w-4" /></button>
                  </>}
                </td>
              </tr>
            ))}
            {!pins.data?.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No PINs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function useAccess() {
  return useQuery({ queryKey: ["my-access"], queryFn: async () => (await supabase.rpc("my_access")).data === true });
}

/** Student: enter a PIN to unlock full exams. */
export function RedeemPin({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-card p-5">
      <h2 className="text-lg font-bold">Unlock full exams</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your Access PIN to start full exams. Don't have one? <Link to="/messages" className="font-bold text-primary">Message Admin</Link> to get your PIN.
      </p>
      <form className="mt-3 flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setBusy(true);
        const { data, error } = await supabase.rpc("redeem_pin", { _code: code });
        setBusy(false);
        if (error) { toast.error(error.message); return; }
        if (!data) { toast.error("That PIN is wrong or already used."); return; }
        toast.success("Access unlocked! You can now start full exams.");
        setCode("");
        await qc.invalidateQueries({ queryKey: ["my-access"] });
        onDone?.();
      }}>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SCH-1234-5678" className="font-mono" />
        <Button disabled={busy}>Activate</Button>
      </form>
    </div>
  );
}

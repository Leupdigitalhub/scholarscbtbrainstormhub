import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { LogIn, PlayCircle, Send, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({ meta: [{ title: "Activity Center — SCHOLARS CBT" }, { name: "robots", content: "noindex" }] }),
  component: ActivityCenter,
});

const filters = [
  { k: "all", l: "All" }, { k: "login", l: "Sign-ins" }, { k: "exam", l: "Exams" }, { k: "alerts", l: "Alerts" },
];

type N = { id: string; kind: string; title: string; body: string; created_at: string; attempt_id: string | null };
type Row = { key: string; ids: string[]; kind: string; title: string; body: string; at: string; started?: string; submitted?: string };

const clean = (b: string) => b.replace(/\s*·?\s*id:[0-9a-f-]+$/, "");

/** Merge each attempt's "started" + "submitted" notices into one row. */
function group(list: N[]): Row[] {
  const byAttempt = new Map<string, Row>();
  const out: Row[] = [];
  for (const n of list) {
    if ((n.kind === "started" || n.kind === "submitted") && n.attempt_id) {
      let r = byAttempt.get(n.attempt_id);
      if (!r) {
        r = { key: n.attempt_id, ids: [], kind: "exam", title: "", body: clean(n.body), at: n.created_at };
        byAttempt.set(n.attempt_id, r); out.push(r);
      }
      r.ids.push(n.id);
      if (n.kind === "started") r.started = n.created_at; else { r.submitted = n.created_at; r.body = clean(n.body) || r.body; }
      r.title = n.title.replace(/ (started|submitted).*$/i, "") || n.title;
      continue;
    }
    out.push({ key: n.id, ids: [n.id], kind: n.kind, title: n.title, body: clean(n.body), at: n.created_at });
  }
  return out;
}

const t = (d?: string) => d ? new Date(d).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—";

function ActivityCenter() {
  const qc = useQueryClient();
  const [f, setF] = useState("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const q = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async () => ((await supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(400)).data ?? []) as N[],
    refetchInterval: 15000,
  });
  useEffect(() => {
    const ch = supabase.channel("activity-feed").on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, () => void qc.invalidateQueries({ queryKey: ["admin-activity"] })).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);
  const all = useMemo(() => group(q.data ?? []), [q.data]);
  const rows = all.filter((r) => f === "all" || (f === "alerts" ? ["tab_switch", "camera_off", "face_missing"].includes(r.kind) : r.kind === f));
  const today = (q.data ?? []).filter((n) => n.kind === "login" && new Date(n.created_at).toDateString() === new Date().toDateString()).length;
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.key));

  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  async function remove() {
    const ids = rows.filter((r) => sel.has(r.key)).flatMap((r) => r.ids);
    if (!ids.length) return;
    if (!confirm(`Delete ${sel.size} selected item(s)?`)) return;
    const { error } = await supabase.from("admin_notifications").delete().in("id", ids);
    if (error) { toast.error("Could not delete: " + error.message); return; }
    toast.success("Deleted");
    setSel(new Set());
    void qc.invalidateQueries({ queryKey: ["admin-activity"] });
    void qc.invalidateQueries({ queryKey: ["admin-notifications"] });
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Activity Center</h1>
      <p className="text-muted-foreground">Live log of student sign-ins and exam activity. <b className="text-foreground">{today}</b> sign-ins today.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {filters.map((x) => (
          <button key={x.k} onClick={() => { setF(x.k); setSel(new Set()); }} className={cn("rounded-full px-4 py-1.5 text-sm font-bold", f === x.k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}>{x.l}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="h-4 w-4" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map((r) => r.key)))} />Select all
          </label>
          <Button variant="destructive" size="sm" disabled={!sel.size} onClick={remove}><Trash2 className="mr-1 h-4 w-4" />Delete ({sel.size})</Button>
        </div>
      </div>
      <div className="mt-4 divide-y rounded-2xl border bg-card">
        {rows.length === 0 ? <p className="p-6 text-center text-muted-foreground">Nothing here yet.</p> : rows.map((r) => {
          const Icon = r.kind === "login" ? LogIn : r.kind === "exam" ? (r.submitted ? Send : PlayCircle) : AlertTriangle;
          const alert = !["login", "exam"].includes(r.kind);
          return (
            <label key={r.key} className={cn("flex cursor-pointer items-start gap-3 p-4", sel.has(r.key) && "bg-primary/5")}>
              <input type="checkbox" className="mt-2.5 h-4 w-4" checked={sel.has(r.key)} onChange={() => toggle(r.key)} />
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", alert ? "bg-destructive/15 text-destructive" : r.kind === "login" ? "bg-success/15 text-success" : "bg-primary/10 text-primary")}><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{r.title}</p>
                {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
                {r.kind === "exam" && (
                  <p className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">Started {t(r.started)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 font-bold", r.submitted ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{r.submitted ? `Submitted ${t(r.submitted)}` : "Still writing"}</span>
                  </p>
                )}
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">{t(r.at)}</p>
            </label>
          );
        })}
      </div>
    </div>
  );
}

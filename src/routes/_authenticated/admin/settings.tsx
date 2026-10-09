import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { type GradeBand, useLists, useSettings } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSettings();
  const qc = useQueryClient();
  const [scale, setScale] = useState<GradeBand[]>([]);
  useEffect(() => { if (data) setScale(data.grade_scale); }, [data]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-extrabold">Settings</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <ListEditor table="subjects" title="Subjects" />
        <ListEditor table="classes" title="Classes" />
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-bold">Grading scale</h2>
        <p className="text-sm text-muted-foreground">Minimum percentage for each grade.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {scale.map((b, i) => (
            <div key={i} className="space-y-1 rounded-lg bg-muted p-2">
              <Input value={b.grade} onChange={(e) => setScale(scale.map((x, j) => j === i ? { ...x, grade: e.target.value } : x))} className="h-8 bg-card text-center font-bold" />
              <Input type="number" value={b.min} onChange={(e) => setScale(scale.map((x, j) => j === i ? { ...x, min: Number(e.target.value) } : x))} className="h-8 bg-card text-center" />
            </div>
          ))}
        </div>
        <Button className="mt-4" onClick={async () => {
          const { error } = await supabase.from("app_settings").update({ grade_scale: scale }).eq("id", 1);
          if (error) { toast.error(error.message); return; }
          toast.success("Grading scale saved");
          qc.invalidateQueries({ queryKey: ["settings"] });
        }}>Save grading scale</Button>
      </div>
      <div className="rounded-2xl border bg-card p-6 text-sm">
        <p className="font-bold">Your links</p>
        <p className="mt-2">Student link: <span className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}</span></p>
        <p>Private admin login: <span className="font-mono">{typeof window !== "undefined" ? `${window.location.origin}/staff` : ""}</span></p>
      </div>
    </div>
  );
}

function ListEditor({ table, title }: { table: "subjects" | "classes"; title: string }) {
  const { data } = useLists();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const items = table === "subjects" ? data?.subjects : data?.classes;
  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {(items ?? []).map((x) => (
          <span key={x.id} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
            {x.name}
            <button aria-label={`Remove ${x.name}`} onClick={async () => { await supabase.from(table).delete().eq("id", x.id); qc.invalidateQueries({ queryKey: ["lists"] }); }}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const { error } = await supabase.from(table).insert({ name: name.trim() });
        if (error) { toast.error(error.message); return; }
        setName("");
        qc.invalidateQueries({ queryKey: ["lists"] });
      }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Add ${title.toLowerCase().slice(0, -1)}`} />
        <Button>Add</Button>
      </form>
    </div>
  );
}

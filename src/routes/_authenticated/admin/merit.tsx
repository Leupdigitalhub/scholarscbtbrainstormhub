import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { MeritTable } from "@/components/MeritTable";

export const Route = createFileRoute("/_authenticated/admin/merit")({
  component: Merit,
});

function Merit() {
  const [test, setTest] = useState("all");
  const tests = useQuery({ queryKey: ["admin-tests-lite"], queryFn: async () => (await supabase.from("tests").select("id,title").order("created_at", { ascending: false })).data ?? [] });
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Merit List</h1>
          <p className="text-muted-foreground">Full ranking of every student, highest to lowest.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Select value={test} onValueChange={setTest}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exams (overall)</SelectItem>
              {(tests.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
        </div>
      </div>
      <div className="mt-6"><MeritTable testId={test === "all" ? null : test} /></div>
    </div>
  );
}

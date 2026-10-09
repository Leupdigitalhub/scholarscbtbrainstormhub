import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { TestForm } from "@/components/TestForm";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/tests/new")({
  component: NewTest,
});

function NewTest() {
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">Create New Test</h1>
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <TestForm submitLabel="Add Questions →" onSubmit={async (v) => {
          const { data, error } = await supabase.from("tests").insert(v).select("id").single();
          if (error) { toast.error(error.message); return; }
          navigate({ to: "/admin/tests/$testId", params: { testId: data.id } });
        }} />
      </div>
    </div>
  );
}

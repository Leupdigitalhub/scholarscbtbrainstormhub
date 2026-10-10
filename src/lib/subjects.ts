import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Subjects added in Admin Settings — the single list used everywhere. */
export function useSubjects() {
  const q = useQuery({
    queryKey: ["subjects-list"],
    queryFn: async () => ((await supabase.from("subjects").select("name").order("created_at")).data ?? []).map((r) => r.name),
  });
  return q.data ?? [];
}

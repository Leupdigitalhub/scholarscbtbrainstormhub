import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GradeBand = { grade: string; min: number };
export const DEFAULT_SCALE: GradeBand[] = [
  { grade: "A", min: 90 }, { grade: "B", min: 80 }, { grade: "C", min: 70 },
  { grade: "D", min: 60 }, { grade: "E", min: 50 }, { grade: "F", min: 0 },
];

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      return {
        lesson_name: data?.lesson_name ?? "SCHOLARS CBT",
        grade_scale: ((data?.grade_scale as GradeBand[] | null) ?? DEFAULT_SCALE),
      };
    },
  });
}

export function gradeFor(percent: number, scale: GradeBand[] = DEFAULT_SCALE) {
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  return sorted.find((b) => percent >= b.min)?.grade ?? sorted[sorted.length - 1]?.grade ?? "";
}

export function useLists() {
  return useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from("subjects").select("*").order("name"),
        supabase.from("classes").select("*").order("name"),
      ]);
      return { subjects: s.data ?? [], classes: c.data ?? [] };
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      return { user: u.user, profile, isAdmin };
    },
  });
}

export async function getIsAdmin(userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r) => r.role === "admin");
}

export function pct(score: number | null, total: number | null) {
  if (!total) return 0;
  return Math.round(((score ?? 0) / total) * 100);
}

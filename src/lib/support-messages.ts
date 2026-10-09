import { supabase } from "@/integrations/supabase/client";

export type SupportMessage = { id: string; student_id: string; sender: "student" | "admin"; body: string; is_read: boolean; created_at: string };

// The support_messages table is newer than the generated types, so it is accessed untyped here.
type Q = {
  select: (c: string) => Q; insert: (v: object) => Q; update: (v: object) => Q; delete: () => Q;
  eq: (c: string, v: unknown) => Q; in: (c: string, v: unknown[]) => Q; order: (c: string, o?: object) => Q; limit: (n: number) => Q;
  then: <T>(cb: (r: { data: SupportMessage[] | null; error: { message: string } | null }) => T) => Promise<T>;
};
export const supportTable = () => (supabase as unknown as { from: (t: string) => Q }).from("support_messages");

export async function loadThread(studentId?: string) {
  let q = supportTable().select("*").order("created_at", { ascending: true }).limit(1000);
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

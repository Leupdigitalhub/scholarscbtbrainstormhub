import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PENDING = "pending-avatar";

export const avatarPath = (uid: string) => `${uid}/avatar.jpg`;

export async function uploadAvatar(uid: string, blob: Blob) {
  const { error } = await supabase.storage.from("proctor").upload(avatarPath(uid), blob, { contentType: "image/jpeg", upsert: true });
  return !error;
}

/** Keep the selfie until the student first logs in (needed when email confirmation is on). */
export async function savePendingAvatar(email: string, blob: Blob) {
  const url = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(blob); });
  try { localStorage.setItem(PENDING, JSON.stringify({ email: email.toLowerCase(), url })); } catch { /* storage full */ }
}

export async function flushPendingAvatar(uid: string, email: string | undefined) {
  try {
    const raw = localStorage.getItem(PENDING);
    if (!raw) return false;
    const p = JSON.parse(raw) as { email: string; url: string };
    if (!email || p.email !== email.toLowerCase()) return false;
    const blob = await (await fetch(p.url)).blob();
    if (await uploadAvatar(uid, blob)) { localStorage.removeItem(PENDING); return true; }
  } catch { /* ignore */ }
  return false;
}

export function useAvatar(uid: string | undefined) {
  return useQuery({
    queryKey: ["avatar", uid],
    enabled: !!uid,
    staleTime: 30 * 60_000,
    queryFn: async () => (await supabase.storage.from("proctor").createSignedUrl(avatarPath(uid!), 3600)).data?.signedUrl ?? null,
  });
}

/** Random STUDENT ID like SCHCBT0342. */
export function makeStudentId(rand: () => number = Math.random) {
  return "SCHCBT" + String(Math.floor(rand() * 10000)).padStart(4, "0");
}

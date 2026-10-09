import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const OFFLINE_AFTER_MS = 3 * 60_000;
const EMAIL_EVERY_MS = 5 * 60_000;

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

/**
 * Emails the administrator a digest of unseen activity, but only while they are away
 * from the admin portal, and at most once every few minutes. Any signed-in user's
 * page can trigger it; it only ever sends to the administrator.
 */
export const flushAdminEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("app_settings").select("admin_last_seen,last_email_at").eq("id", 1).maybeSingle();
    const now = Date.now();
    if (s?.admin_last_seen && now - new Date(s.admin_last_seen).getTime() < OFFLINE_AFTER_MS) return { sent: 0, reason: "admin online" };
    if (s?.last_email_at && now - new Date(s.last_email_at).getTime() < EMAIL_EVERY_MS) return { sent: 0, reason: "throttled" };

    const { data: items } = await supabaseAdmin.from("admin_notifications").select("*")
      .eq("emailed", false).eq("is_read", false).order("created_at").limit(100);
    if (!items?.length) return { sent: 0, reason: "nothing new" };

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const emails: string[] = [];
    for (const r of roles ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      if (data.user?.email) emails.push(data.user.email);
    }
    if (!emails.length) return { sent: 0, reason: "no admin email" };

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
    if (!lovableKey || !gmailKey) throw new Error("Email is not connected");

    const lines = items.map((n) => `• ${new Date(n.created_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} — ${n.title}${n.body ? ` (${n.body})` : ""}`);
    const subject = `SCHOLARS CBT: ${items.length} new ${items.length === 1 ? "activity" : "activities"} waiting`;
    const body = `Hello,\r\n\r\nWhile you were away from the admin portal:\r\n\r\n${lines.join("\r\n")}\r\n\r\nSign in to the staff portal to see details and watch recordings.\r\n`;
    const raw = b64([`To: ${emails.join(", ")}`, `Subject: ${header(subject)}`, "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n"))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`Gmail send failed [${res.status}]: ${t}`);
      throw new Error(`Email failed [${res.status}]: ${t}`);
    }
    await supabaseAdmin.from("admin_notifications").update({ emailed: true }).in("id", items.map((i) => i.id));
    await supabaseAdmin.from("app_settings").update({ last_email_at: new Date().toISOString() }).eq("id", 1);
    return { sent: items.length, reason: "sent" };
  });

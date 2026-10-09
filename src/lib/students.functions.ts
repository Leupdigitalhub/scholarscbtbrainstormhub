import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: permanently removes a student account and all of their exam data. */
export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input.studentId)) throw new Error("Invalid student");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.studentId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.rpc("has_role", { _user_id: data.studentId, _role: "admin" });
    if (target) throw new Error("Administrator accounts cannot be deleted here");
    const { data: atts } = await supabaseAdmin.from("attempts").select("id").eq("student_id", data.studentId);
    const ids = (atts ?? []).map((a) => a.id);
    if (ids.length) {
      await supabaseAdmin.from("proctor_events").delete().in("attempt_id", ids);
      await supabaseAdmin.from("admin_notifications").delete().in("attempt_id", ids);
      await supabaseAdmin.from("attempts").delete().in("id", ids);
    }
    await supabaseAdmin.from("student_topic_progress").delete().eq("student_id", data.studentId);
    await supabaseAdmin.from("announcements").delete().eq("target_student", data.studentId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

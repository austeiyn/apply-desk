"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, checkRow, fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { deleteAccountCompletely } from "@/lib/account";
import { requireAdminForAction } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { optionalText, requiredText, uuid } from "@/lib/validation/common";

const reasonSchema = z.string().trim().max(500).optional().default("");

export async function setAccountStatusAction(userId: string, status: "active" | "suspended", reason?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId: adminId } = await requireAdminForAction();
    const target = uuid.parse(userId);
    if (target === adminId) return fail("You can't change your own account status.");
    const r = reasonSchema.parse(reason);
    if (status === "suspended" && r.length < 3) return fail("Give a short reason for the suspension (it's recorded in the audit log).");

    // Status change + audit entry happen atomically in the database function,
    // which re-checks admin privileges and refuses to target admins.
    const { error } = await supabase.rpc("admin_set_account_status", { p_user_id: target, p_status: z.enum(["active", "suspended"]).parse(status), p_reason: r });
    if (error) return fail(error.message.includes("Administrator") ? error.message : "We couldn't update that account.");

    // Also block/unblock sign-in and token refresh at the auth layer.
    const { error: banError } = await createAdminClient().auth.admin.updateUserById(target, { ban_duration: status === "suspended" ? "876000h" : "none" });
    if (banError) console.error("[admin] ban update failed", banError.message);

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${target}`);
    return ok(null, status === "suspended" ? "Account suspended." : "Account reactivated.");
  });
}

export async function deleteUserAction(userId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId: adminId } = await requireAdminForAction();
    const target = uuid.parse(userId);
    const v = z
      .object({
        confirmEmail: z.string().trim().toLowerCase(),
        reason: z.string().trim().min(5, "Record why the account is being deleted (e.g. 'User requested deletion by email on 3 May').").max(500),
      })
      .parse(input);
    if (target === adminId) return fail("Use the account settings page to manage your own account.");

    const { data: profile } = await supabase.from("profiles").select("email, role").eq("id", target).maybeSingle();
    if (!profile) return fail("User not found.");
    if (profile.role === "admin") return fail("Administrator accounts can't be deleted here. Revoke the admin role first.");
    if (profile.email.toLowerCase() !== v.confirmEmail) return fail("The email you typed doesn't match this account.", { confirmEmail: ["Doesn't match."] });

    // Audit first (the record keeps the user id but no profile content).
    check(await supabase.rpc("admin_log_action", { p_action: "user.deleted", p_target_type: "user", p_target_id: target, p_metadata: { reason: v.reason } }));
    await deleteAccountCompletely(target);
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return ok(null, "Account and all associated data deleted.");
  });
}

/* Announcements -------------------------------------------------------------- */

const announcementSchema = z
  .object({
    title: requiredText(200, "Enter a title."),
    message: requiredText(2000, "Enter a message."),
    level: z.enum(["info", "success", "warning"]),
    isActive: z.boolean(),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
  })
  .transform((v) => ({
    ...v,
    startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : new Date().toISOString(),
    endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
  }))
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { path: ["endsAt"], message: "End must be after start." });

export async function saveAnnouncementAction(id: string | null, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireAdminForAction();
    const v = announcementSchema.parse(input);
    const row = { title: v.title, message: v.message, level: v.level, is_active: v.isActive, starts_at: v.startsAt, ends_at: v.endsAt };
    let targetId: string;
    if (id) {
      targetId = checkRow(await supabase.from("announcements").update(row).eq("id", uuid.parse(id)).select("id").maybeSingle()).id;
    } else {
      targetId = checkRow(await supabase.from("announcements").insert({ ...row, created_by: userId }).select("id").single()).id;
    }
    await supabase.rpc("admin_log_action", {
      p_action: id ? "announcement.updated" : "announcement.created",
      p_target_type: "announcement",
      p_target_id: targetId,
      p_metadata: { title: v.title, active: v.isActive },
    });
    revalidatePath("/admin/announcements");
    revalidatePath("/dashboard", "layout");
    return ok(null, id ? "Announcement updated." : "Announcement published.");
  });
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase } = await requireAdminForAction();
    const target = uuid.parse(id);
    const data = check(await supabase.from("announcements").delete().eq("id", target).select("title"));
    if (!data?.length) return fail("Announcement not found.");
    await supabase.rpc("admin_log_action", { p_action: "announcement.deleted", p_target_type: "announcement", p_target_id: target, p_metadata: { title: data[0]!.title } });
    revalidatePath("/admin/announcements");
    revalidatePath("/dashboard", "layout");
    return ok(null, "Announcement deleted.");
  });
}

/* Platform settings ------------------------------------------------------------ */

const settingsSchema = z.object({
  registration_open: z.boolean(),
  ai_enabled: z.boolean(),
  ai_daily_request_limit: z.coerce.number().int().min(0).max(10000),
  ai_monthly_request_limit: z.coerce.number().int().min(0).max(100000),
  max_source_cvs: z.coerce.number().int().min(1).max(50),
  support_email: optionalText(320).refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address."),
});

export async function updateSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase } = await requireAdminForAction();
    const v = settingsSchema.parse(input);
    const { data: current } = await supabase.from("platform_settings").select("key, value");
    const currentMap = new Map((current ?? []).map((r) => [r.key, JSON.stringify(r.value)]));
    const entries = Object.entries({ ...v, support_email: v.support_email ?? "" });
    for (const [key, value] of entries) {
      if (currentMap.get(key) === JSON.stringify(value)) continue;
      // RLS allows only admins to update; a trigger writes the audit entry.
      const data = check(await supabase.from("platform_settings").update({ value }).eq("key", key).select("key"));
      if (!data?.length) return fail("You don't have permission to change settings.");
    }
    revalidatePath("/admin/settings");
    return ok(null, "Settings saved.");
  });
}

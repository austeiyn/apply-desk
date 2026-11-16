"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { check, fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { deleteAccountCompletely } from "@/lib/account";
import { requireActiveUserForAction } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";

/** Verify the current password without touching the caller's session cookies. */
async function verifyPassword(email: string, password: string): Promise<boolean> {
  const probe = createSupabaseClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (!error) await probe.auth.signOut({ scope: "local" });
  return !error;
}

export async function changeEmailAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const { email } = z.object({ email: emailSchema }).parse(input);
    if (!(await rateLimit(`email-change:${userId}`, 3, 3600))) return fail("Too many attempts. Try again later.");
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${publicEnv.appUrl}/auth/confirm?next=/dashboard/settings` });
    if (error) {
      if (error.code === "email_exists") return fail("That email address is already in use.");
      return fail("We couldn't start the email change. Please try again.");
    }
    return ok(null, "Check both your current and new inbox to confirm the change.");
  });
}

export async function changePasswordAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, email, userId } = await requireActiveUserForAction();
    const v = z
      .object({ currentPassword: z.string().min(1, "Enter your current password."), password: passwordSchema, confirmPassword: z.string() })
      .refine((x) => x.password === x.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." })
      .parse(input);
    if (!(await rateLimit(`pw-change:${userId}`, 5, 900))) return fail("Too many attempts. Try again later.");
    if (!(await verifyPassword(email, v.currentPassword))) return fail("Your current password is incorrect.", { currentPassword: ["Incorrect password."] });
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) {
      if (error.code === "same_password") return fail("Choose a password you haven't used before.");
      return fail("We couldn't update your password.");
    }
    return ok(null, "Password updated.");
  });
}

const SUPPORT_HOURS = [24, 72, 168] as const;

export async function setSupportAccessAction(hours: number | null): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    if (hours !== null && !SUPPORT_HOURS.includes(hours as (typeof SUPPORT_HOURS)[number])) return fail("Invalid duration.");
    const until = hours === null ? null : new Date(Date.now() + hours * 3600_000).toISOString();
    check(await supabase.from("profiles").update({ support_access_expires_at: until }).eq("id", userId));
    return ok(null, hours === null ? "Support access revoked." : `Support access granted for ${hours === 168 ? "7 days" : `${hours} hours`}.`);
  });
}

export async function deleteMyAccountAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId, email, profile } = await requireActiveUserForAction();
    const v = z.object({ password: z.string().min(1, "Enter your password."), confirm: z.literal("DELETE", { error: 'Type DELETE to confirm.' }) }).parse(input);
    const ip = await clientIp();
    if (!(await rateLimit(`delete-account:${ip}`, 5, 3600))) return fail("Too many attempts. Try again later.");
    if (profile.role === "admin") {
      return fail("Administrator accounts can't be deleted here. Remove the admin role first (see the admin guide).");
    }
    if (!(await verifyPassword(email, v.password))) return fail("Your password is incorrect.", { password: ["Incorrect password."] });

    await deleteAccountCompletely(userId);
    await supabase.auth.signOut();
    return ok(null);
  });
}

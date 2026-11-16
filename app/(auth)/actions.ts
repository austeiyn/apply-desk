"use server";

import { redirect } from "next/navigation";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { safeNextPath } from "@/lib/auth/redirect";
import { publicEnv } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { getPlatformSettings } from "@/lib/settings";

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

export async function registerAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  return runAction(async () => {
    const values = registerSchema.parse(input);
    const ip = await clientIp();
    if (!(await rateLimit(`register:${ip}`, 5, 600))) return fail(TOO_MANY);

    const settings = await getPlatformSettings();
    if (!settings.registration_open) {
      return fail("Registration is currently closed. Please check back soon.");
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName },
        emailRedirectTo: `${publicEnv.appUrl}/auth/confirm?next=/onboarding`,
      },
    });

    if (error) {
      if (error.code === "weak_password") return fail("Choose a stronger password.", { password: [error.message] });
      if (error.code === "over_email_send_rate_limit") return fail(TOO_MANY);
      if (error.code === "signup_disabled") return fail("Registration is currently closed.");
      // "User already registered" is intentionally not revealed (account enumeration).
      if (error.code !== "user_already_exists") {
        console.error("[register] signUp failed", error.code, error.message);
        return fail("We couldn't create your account. Please try again.");
      }
    }
    return ok({ email: values.email });
  });
}

export async function loginAction(input: unknown): Promise<ActionResult<never>> {
  const result = await runAction(async () => {
    const values = loginSchema.parse(input);
    const ip = await clientIp();
    if (!(await rateLimit(`login:${ip}`, 20, 300)) || !(await rateLimit(`login:${values.email}`, 10, 300))) {
      return fail(TOO_MANY);
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
    if (error) {
      if (error.code === "email_not_confirmed") {
        return fail("Please confirm your email address first. Check your inbox for the verification link.", {
          _unconfirmed: ["true"],
        });
      }
      if (error.code === "user_banned") {
        return fail("This account has been suspended. Contact support if you think this is a mistake.");
      }
      return fail("Incorrect email or password.");
    }
    return ok(undefined as never);
  });
  if (!result.ok) return result;
  const values = loginSchema.parse(input);
  redirect(safeNextPath(values.next, "/dashboard"));
}

export async function resendVerificationAction(email: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = emailSchema.parse(email);
    const ip = await clientIp();
    if (!(await rateLimit(`resend:${ip}`, 5, 600)) || !(await rateLimit(`resend:${parsed}`, 3, 600))) return fail(TOO_MANY);
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed,
      options: { emailRedirectTo: `${publicEnv.appUrl}/auth/confirm?next=/onboarding` },
    });
    if (error && error.code === "over_email_send_rate_limit") return fail(TOO_MANY);
    // Same response whether or not the account exists.
    return ok(null, "If that account is awaiting verification, we've sent a new link.");
  });
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { email } = forgotPasswordSchema.parse(input);
    const ip = await clientIp();
    if (!(await rateLimit(`forgot:${ip}`, 5, 600)) || !(await rateLimit(`forgot:${email}`, 3, 900))) return fail(TOO_MANY);
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicEnv.appUrl}/auth/confirm?next=/reset-password`,
    });
    if (error && error.code === "over_email_send_rate_limit") return fail(TOO_MANY);
    if (error) console.error("[forgot-password]", error.code, error.message);
    return ok(null);
  });
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { password } = resetPasswordSchema.parse(input);
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) {
      return fail("Your reset link has expired. Request a new one to continue.");
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      if (error.code === "same_password") return fail("Choose a password you haven't used before.", { password: [error.message] });
      if (error.code === "weak_password") return fail("Choose a stronger password.", { password: [error.message] });
      return fail("We couldn't update your password. Please request a new reset link.");
    }
    return ok(null, "Your password has been updated.");
  });
}

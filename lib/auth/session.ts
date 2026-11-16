import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db/types";

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
  supabase: ServerSupabaseClient;
}

/**
 * Resolve the signed-in user for this request (deduplicated per request).
 * The JWT is verified via getClaims(); the profile row is then read through
 * RLS, which also proves the account still exists.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return null;

  return {
    userId,
    email: (data.claims.email as string | undefined) ?? profile.email,
    profile,
    supabase,
  };
});

interface RequireUserOptions {
  /** Redirect to onboarding when the user hasn't completed it. Default true. */
  requireOnboarding?: boolean;
}

/** For pages: ensure an active, signed-in user or redirect appropriately. */
export async function requireUser(options: RequireUserOptions = {}): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.account_status !== "active") redirect("/suspended");
  if (options.requireOnboarding !== false && !session.profile.onboarding_completed_at) {
    redirect("/onboarding");
  }
  return session;
}

/**
 * For admin pages. Non-admins get a 404 so the admin area isn't advertised.
 * Database functions re-check admin status (public.assert_admin()).
 */
export async function requireAdmin(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.profile.account_status !== "active" || session.profile.role !== "admin") notFound();
  return session;
}

export class AuthorizationError extends Error {
  constructor(message = "You need to be signed in to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function requireActiveUserForAction(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new AuthorizationError();
  if (session.profile.account_status !== "active") {
    throw new AuthorizationError("Your account is suspended. Contact support for help.");
  }
  return session;
}

export async function requireAdminForAction(): Promise<SessionContext> {
  const session = await requireActiveUserForAction();
  if (session.profile.role !== "admin") throw new AuthorizationError("Administrator access required.");
  return session;
}

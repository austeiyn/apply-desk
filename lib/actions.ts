import "server-only";

import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/session";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Postgres/PostgREST error codes we translate into user-facing messages. */
function describeDbError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: string }).code;
  switch (code) {
    case "23505":
      return "That item already exists.";
    case "23503":
      return "A related record could not be found. Refresh the page and try again.";
    case "23514":
      return "Some values are outside the allowed range. Check your input and try again.";
    case "42501":
      return "You don't have permission to do that.";
    case "PGRST116":
      return "We couldn't find that item. It may have been deleted.";
    default:
      return null;
  }
}

/**
 * Wrap a server action body with consistent error handling. Validation
 * errors become field errors, auth errors become messages, and anything
 * unexpected is logged server-side and returned as a generic message (no
 * internals leak to the client).
 */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AuthorizationError) return fail(error.message);
    if (error instanceof z.ZodError) return fail("Please check the highlighted fields.", flattenZod(error));
    const dbMessage = describeDbError(error);
    if (dbMessage) return fail(dbMessage);
    // Re-throw Next.js control-flow errors (redirect/notFound).
    if (error && typeof error === "object" && "digest" in error && typeof (error as { digest: unknown }).digest === "string") {
      const digest = (error as { digest: string }).digest;
      if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw error;
    }
    console.error("[action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}

export function flattenZod(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Throw a Supabase error so runAction can translate it. */
export function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

import "server-only";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/env.server";

/**
 * Fixed-window rate limit backed by Postgres (works across serverless
 * instances, unlike in-memory counters). Returns true when allowed.
 *
 * If the service role key is missing (misconfigured deployment) we fail open
 * for auth flows rather than locking every user out, and log loudly.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!isServiceRoleConfigured()) {
    console.warn("[rate-limit] SUPABASE_SERVICE_ROLE_KEY missing; rate limiting disabled");
    return true;
  }
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: key.slice(0, 200),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] check failed", error.message);
    return true;
  }
  return data === true;
}

/** Best-effort client IP (Netlify sets x-nf-client-connection-ip). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

/** Clear a counter early (used to release short-lived "in progress" locks). */
export async function releaseRateLimit(key: string): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  const { error } = await createAdminClient().from("rate_limits").delete().eq("key", key.slice(0, 200));
  if (error) console.error("[rate-limit] release failed", error.message);
}

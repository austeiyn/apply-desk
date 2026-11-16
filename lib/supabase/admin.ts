import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { assertSupabaseConfigured, publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Only use from trusted server code AFTER performing an explicit
 * authorisation check, and only for operations that genuinely need it
 * (rate limiting, AI usage metering, account deletion, auth admin actions).
 * Never import from client components; "server-only" enforces this.
 */
export function createAdminClient() {
  assertSupabaseConfigured();
  const key = serverEnv.supabaseServiceRoleKey;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured (see .env.example).");
  }
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

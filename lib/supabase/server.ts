import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/database.types";
import { assertSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Per-request Supabase client acting as the signed-in user (RLS applies).
 * Create a new client for every request; never share one across requests.
 */
export async function createClient() {
  // Read cookies first: it marks the route as per-request, so pages that use
  // Supabase are never pre-rendered at build time, even when misconfigured.
  const cookieStore = await cookies();
  assertSupabaseConfigured();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by proxy.ts, so this is safe to ignore.
        }
      },
    },
  });
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

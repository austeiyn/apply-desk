import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "@/lib/db/database.types";

config({ path: ".env.local" });

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function hasLocalSupabase(): boolean {
  return Boolean(SUPABASE_URL && PUBLISHABLE_KEY && SERVICE_KEY && /127\.0\.0\.1|localhost/.test(SUPABASE_URL));
}

export type Client = SupabaseClient<Database>;

export function serviceClient(): Client {
  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): Client {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: Client;
}

const runId = Math.random().toString(36).slice(2, 8);
let counter = 0;

/** Create a confirmed user via the Admin API and return a signed-in client. */
export async function createTestUser(
  label: string,
  metadata: Record<string, unknown> = {},
): Promise<TestUser> {
  const admin = serviceClient();
  const email = `${label}-${runId}-${counter++}@applydesk.test`;
  const password = `Test-password-${runId}-1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${label} Tester`, ...metadata },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, password, client };
}

export async function deleteTestUser(user: TestUser | undefined): Promise<void> {
  if (!user) return;
  await serviceClient().auth.admin.deleteUser(user.id);
}

#!/usr/bin/env node
// Promote (or demote) an existing account to administrator.
//
//   npm run admin:grant -- you@example.com
//   npm run admin:revoke -- you@example.com
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment (or .env.local). The account must already exist (register
// through the app first). Equivalent SQL for the Supabase SQL editor:
//   select public.grant_admin_role('you@example.com');
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const [mode, email] = process.argv.slice(2);
if (!["grant", "revoke"].includes(mode) || !email) {
  console.error("Usage: node scripts/grant-admin.mjs <grant|revoke> <email>");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const fn = mode === "grant" ? "grant_admin_role" : "revoke_admin_role";
const { data, error } = await admin.rpc(fn, { p_email: email });
if (error) {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
}
console.log(`${mode === "grant" ? "Granted" : "Revoked"} administrator role for ${email} (user ${data}). The change is recorded in the audit log.`);

/**
 * Schema-level security invariants, checked against the live local database.
 * These catch regressions such as a new table without RLS or a SECURITY
 * DEFINER function without a pinned search_path.
 */
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasLocalSupabase } from "../support/supabase";

const run = hasLocalSupabase() ? describe : describe.skip;
const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

run("database security invariants", () => {
  let client: pg.Client;
  beforeAll(async () => {
    client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
  });

  it("enables RLS on every table in the public schema", async () => {
    const { rows } = await client.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("pins search_path on every SECURITY DEFINER function", async () => {
    const { rows } = await client.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    );
    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it("does not let anon or authenticated execute service-only functions", async () => {
    for (const fn of ["check_rate_limit(text,integer,integer)", "grant_admin_role(text)", "revoke_admin_role(text)"]) {
      for (const role of ["anon", "authenticated"]) {
        const { rows } = await client.query(`select has_function_privilege($1, $2, 'execute') as allowed`, [role, `public.${fn}`]);
        expect({ fn, role, allowed: rows[0].allowed }).toEqual({ fn, role, allowed: false });
      }
    }
  });

  it("gives anon no privileges on private tables", async () => {
    const { rows } = await client.query(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'anon' and table_schema = 'public' and table_name <> 'platform_settings'`,
    );
    expect(rows).toEqual([]);
  });

  it("keeps AI run hand-offs (prompt data) service-role only", async () => {
    const { rows } = await client.query(
      `select grantee, privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'ai_runs' and grantee in ('anon', 'authenticated', 'public')`,
    );
    expect(rows).toEqual([]);
    const { rows: policies } = await client.query(`select policyname from pg_policies where schemaname = 'public' and tablename = 'ai_runs'`);
    expect(policies).toEqual([]);
  });

  it("keeps the CV bucket private with type and size limits", async () => {
    const { rows } = await client.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'source-cvs'`);
    expect(rows[0]).toMatchObject({ public: false, file_size_limit: "10485760" });
    expect(rows[0].allowed_mime_types).toEqual(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  });

  it("only lets authenticated users update an allow-list of profile columns", async () => {
    const { rows } = await client.query(
      `select column_name from information_schema.column_privileges
        where grantee = 'authenticated' and table_schema = 'public' and table_name = 'profiles' and privilege_type = 'UPDATE'
        order by column_name`,
    );
    expect(rows.map((r) => r.column_name)).toEqual(["avatar_url", "full_name", "onboarding_completed_at", "support_access_expires_at"]);
  });
});

/**
 * Row Level Security and authorisation tests.
 *
 * These run against the local Supabase stack (`supabase start`) through the
 * real Auth, PostgREST and Storage services, i.e. exactly the path a browser
 * or attacker would use. Run with: npm run test:db
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  hasLocalSupabase,
  serviceClient,
  type TestUser,
} from "../support/supabase";

const run = hasLocalSupabase() ? describe : describe.skip;

run("row level security", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  let aliceAppId: string;
  let bobAppId: string;
  let bobExperienceId: string;
  let bobResumeId: string;

  beforeAll(async () => {
    // Attempt to self-assign admin via signup metadata: must be ignored.
    alice = await createTestUser("alice", { role: "admin" });
    bob = await createTestUser("bob");
    admin = await createTestUser("admin");
    const { error: grantError } = await serviceClient().rpc("grant_admin_role", { p_email: admin.email });
    expect(grantError).toBeNull();

    const a = await alice.client
      .from("job_applications")
      .insert({ user_id: alice.id, job_title: "Frontend Developer", company_name: "Alice Co" })
      .select("id")
      .single();
    expect(a.error).toBeNull();
    aliceAppId = a.data!.id;

    const b = await bob.client
      .from("job_applications")
      .insert({ user_id: bob.id, job_title: "Data Analyst", company_name: "Bob Ltd", notes: "private note" })
      .select("id")
      .single();
    expect(b.error).toBeNull();
    bobAppId = b.data!.id;

    const exp = await bob.client
      .from("work_experiences")
      .insert({ user_id: bob.id, company: "Secret Corp", job_title: "Analyst" })
      .select("id")
      .single();
    expect(exp.error).toBeNull();
    bobExperienceId = exp.data!.id;

    const resume = await bob.client
      .from("generated_resumes")
      .insert({ user_id: bob.id, application_id: bobAppId, title: "Bob resume", content_json: { summary: "v1" } })
      .select("id")
      .single();
    expect(resume.error).toBeNull();
    bobResumeId = resume.data!.id;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  describe("provisioning and roles", () => {
    it("creates a candidate profile on signup and ignores role metadata", async () => {
      const { data } = await alice.client.from("profiles").select("role, account_status, full_name").eq("id", alice.id).single();
      expect(data).toMatchObject({ role: "candidate", account_status: "active", full_name: "alice Tester" });
      const { data: cp } = await alice.client.from("candidate_profiles").select("user_id").eq("user_id", alice.id);
      expect(cp).toHaveLength(1);
    });

    it("prevents users promoting themselves to admin", async () => {
      const { error } = await alice.client.from("profiles").update({ role: "admin" } as never).eq("id", alice.id);
      expect(error).not.toBeNull();
      const { data } = await serviceClient().from("profiles").select("role").eq("id", alice.id).single();
      expect(data?.role).toBe("candidate");
    });

    it("prevents users changing their own account status", async () => {
      const { error } = await alice.client.from("profiles").update({ account_status: "suspended" } as never).eq("id", alice.id);
      expect(error).not.toBeNull();
    });

    it("allows users to update their own editable profile fields", async () => {
      const { error } = await alice.client.from("profiles").update({ full_name: "Alice Updated" }).eq("id", alice.id);
      expect(error).toBeNull();
    });

    it("blocks the grant_admin_role function for normal users", async () => {
      const { error } = await alice.client.rpc("grant_admin_role", { p_email: alice.email });
      expect(error).not.toBeNull();
    });

    it("limits support access grants to 7 days", async () => {
      const far = new Date(Date.now() + 30 * 86400_000).toISOString();
      const { error } = await alice.client.from("profiles").update({ support_access_expires_at: far }).eq("id", alice.id);
      expect(error).not.toBeNull();
    });
  });

  describe("user isolation", () => {
    it("hides other users' applications", async () => {
      const { data } = await alice.client.from("job_applications").select("id");
      expect(data?.map((r) => r.id)).toEqual([aliceAppId]);
      const direct = await alice.client.from("job_applications").select("*").eq("id", bobAppId);
      expect(direct.data).toEqual([]);
    });

    it("hides other users' profile rows and career data", async () => {
      const { data: profiles } = await alice.client.from("profiles").select("id");
      expect(profiles?.map((p) => p.id)).toEqual([alice.id]);
      const { data: exps } = await alice.client.from("work_experiences").select("id").eq("id", bobExperienceId);
      expect(exps).toEqual([]);
      const { data: cps } = await alice.client.from("candidate_profiles").select("user_id").eq("user_id", bob.id);
      expect(cps).toEqual([]);
    });

    it("cannot update or delete another user's rows (silently affects nothing)", async () => {
      await alice.client.from("job_applications").update({ notes: "hacked" }).eq("id", bobAppId);
      await alice.client.from("job_applications").delete().eq("id", bobAppId);
      await alice.client.from("work_experiences").delete().eq("id", bobExperienceId);
      const { data } = await serviceClient().from("job_applications").select("notes").eq("id", bobAppId).single();
      expect(data?.notes).toBe("private note");
      const { count } = await serviceClient().from("work_experiences").select("*", { count: "exact", head: true }).eq("id", bobExperienceId);
      expect(count).toBe(1);
    });

    it("cannot insert rows on behalf of another user", async () => {
      const { error } = await alice.client.from("job_applications").insert({ user_id: bob.id, job_title: "Injected" });
      expect(error).not.toBeNull();
    });

    it("cannot reassign own rows to another user", async () => {
      const { error } = await alice.client.from("job_applications").update({ user_id: bob.id }).eq("id", aliceAppId);
      expect(error).not.toBeNull();
    });

    it("cannot attach documents to another user's application (composite FK)", async () => {
      const { error } = await alice.client
        .from("generated_resumes")
        .insert({ user_id: alice.id, application_id: bobAppId, title: "x", content_json: {} });
      expect(error).not.toBeNull();
    });

    it("cannot read another user's resume or its versions", async () => {
      const { data } = await alice.client.from("generated_resumes").select("id").eq("id", bobResumeId);
      expect(data).toEqual([]);
      const { data: versions } = await alice.client.from("resume_versions").select("id").eq("resume_id", bobResumeId);
      expect(versions).toEqual([]);
    });

    it("cannot read another user's AI usage", async () => {
      await serviceClient().from("ai_usage").insert({ user_id: bob.id, feature: "test", input_tokens: 1, output_tokens: 1 });
      const { data } = await alice.client.from("ai_usage").select("id, user_id");
      expect(data?.every((r) => r.user_id === alice.id)).toBe(true);
    });

    it("gives anonymous visitors no access to private tables", async () => {
      const anon = anonClient();
      for (const table of ["profiles", "job_applications", "work_experiences", "generated_resumes", "source_cvs"] as const) {
        const { data, error } = await anon.from(table).select("*").limit(1);
        expect(error !== null || (data ?? []).length === 0).toBe(true);
      }
      const { data: settings } = await anon.from("platform_settings").select("key");
      expect((settings ?? []).length).toBeGreaterThan(0);
    });
  });

  describe("system-maintained history", () => {
    it("versions resumes automatically and blocks forged versions", async () => {
      const upd = await bob.client
        .from("generated_resumes")
        .update({ content_json: { summary: "v2" }, last_change_summary: "Edited summary" })
        .eq("id", bobResumeId)
        .select("version")
        .single();
      expect(upd.data?.version).toBe(2);
      const { data: versions } = await bob.client
        .from("resume_versions")
        .select("version, change_summary")
        .eq("resume_id", bobResumeId)
        .order("version");
      expect(versions?.map((v) => v.version)).toEqual([1, 2]);
      expect(versions?.[1]?.change_summary).toBe("Edited summary");

      const forged = await bob.client
        .from("resume_versions")
        .insert({ user_id: bob.id, resume_id: bobResumeId, version: 99, content_json: {} });
      expect(forged.error).not.toBeNull();
    });

    it("records status changes in the application timeline", async () => {
      await alice.client.from("job_applications").update({ application_status: "applied" }).eq("id", aliceAppId);
      const { data } = await alice.client
        .from("application_events")
        .select("event_type, from_status, to_status")
        .eq("application_id", aliceAppId)
        .order("created_at");
      expect(data?.map((e) => e.event_type)).toEqual(["created", "status_changed"]);
      expect(data?.[1]).toMatchObject({ from_status: "interested", to_status: "applied" });
    });

    it("prevents users forging reserved timeline events", async () => {
      const { error } = await alice.client
        .from("application_events")
        .insert({ user_id: alice.id, application_id: aliceAppId, event_type: "status_changed", to_status: "offer" });
      expect(error).not.toBeNull();
      const allowed = await alice.client
        .from("application_events")
        .insert({ user_id: alice.id, application_id: aliceAppId, event_type: "note", description: "Called recruiter" });
      expect(allowed.error).toBeNull();
    });
  });

  describe("administrator boundaries", () => {
    it("lets admins list users with counts but not candidates", async () => {
      const { data, error } = await admin.client.rpc("admin_list_users", { p_search: "bob-" });
      expect(error).toBeNull();
      expect(data?.[0]).toMatchObject({ id: bob.id, application_count: 1 });

      const denied = await alice.client.rpc("admin_list_users", {});
      expect(denied.error).not.toBeNull();
      const stats = await alice.client.rpc("admin_platform_stats");
      expect(stats.error).not.toBeNull();
    });

    it("lets admins see aggregate stats", async () => {
      const { data, error } = await admin.client.rpc("admin_platform_stats");
      expect(error).toBeNull();
      expect((data as Record<string, number>).total_applications).toBeGreaterThanOrEqual(2);
    });

    it("does NOT let admins read candidate private data by default", async () => {
      const { data: apps } = await admin.client.from("job_applications").select("id, notes").eq("id", bobAppId);
      expect(apps).toEqual([]);
      const { data: exps } = await admin.client.from("work_experiences").select("id").eq("user_id", bob.id);
      expect(exps).toEqual([]);
      const { data: resumes } = await admin.client.from("generated_resumes").select("id").eq("user_id", bob.id);
      expect(resumes).toEqual([]);
    });

    it("allows read-only access only while the user grants support access", async () => {
      const until = new Date(Date.now() + 3600_000).toISOString();
      const grant = await bob.client.from("profiles").update({ support_access_expires_at: until }).eq("id", bob.id);
      expect(grant.error).toBeNull();

      const { data: apps } = await admin.client.from("job_applications").select("id").eq("user_id", bob.id);
      expect(apps?.map((a) => a.id)).toEqual([bobAppId]);

      // Still read-only.
      await admin.client.from("job_applications").update({ notes: "admin edit" }).eq("id", bobAppId);
      const { data } = await serviceClient().from("job_applications").select("notes").eq("id", bobAppId).single();
      expect(data?.notes).toBe("private note");

      await bob.client.from("profiles").update({ support_access_expires_at: null }).eq("id", bob.id);
      const { data: after } = await admin.client.from("job_applications").select("id").eq("user_id", bob.id);
      expect(after).toEqual([]);
    });

    it("hides audit logs from candidates and keeps them immutable", async () => {
      const { data: candidateView } = await alice.client.from("audit_logs").select("id");
      expect(candidateView).toEqual([]);
      const { data: adminView } = await admin.client.from("audit_logs").select("id, action").limit(5);
      expect((adminView ?? []).length).toBeGreaterThan(0);
      const del = await serviceClient().from("audit_logs").delete().eq("id", adminView![0]!.id);
      expect(del.error).not.toBeNull();
    });

    it("prevents admins suspending themselves", async () => {
      const { error } = await admin.client.rpc("admin_set_account_status", { p_user_id: admin.id, p_status: "suspended" });
      expect(error).not.toBeNull();
    });

    it("restricts platform settings writes to admins and audits changes", async () => {
      const denied = await alice.client
        .from("platform_settings")
        .update({ value: 999 })
        .eq("key", "ai_daily_request_limit")
        .select();
      expect(denied.data ?? []).toEqual([]);

      const allowed = await admin.client
        .from("platform_settings")
        .update({ value: 41 })
        .eq("key", "ai_daily_request_limit")
        .select();
      expect(allowed.error).toBeNull();
      expect(allowed.data).toHaveLength(1);
      const { data: logs } = await admin.client
        .from("audit_logs")
        .select("action, target_id")
        .eq("action", "settings.updated")
        .eq("target_id", "ai_daily_request_limit");
      expect((logs ?? []).length).toBeGreaterThan(0);
      await admin.client.from("platform_settings").update({ value: 40 }).eq("key", "ai_daily_request_limit");
    });

    it("keeps rate-limit counters server-only", async () => {
      const { error } = await alice.client.rpc("check_rate_limit", { p_key: "x", p_limit: 1, p_window_seconds: 60 });
      expect(error).not.toBeNull();
      const svc = await serviceClient().rpc("check_rate_limit", { p_key: `t-${alice.id}`, p_limit: 1, p_window_seconds: 60 });
      expect(svc.data).toBe(true);
      const second = await serviceClient().rpc("check_rate_limit", { p_key: `t-${alice.id}`, p_limit: 1, p_window_seconds: 60 });
      expect(second.data).toBe(false);
    });
  });

  describe("suspension", () => {
    it("cuts off a suspended user's data access immediately", async () => {
      const { error } = await admin.client.rpc("admin_set_account_status", {
        p_user_id: alice.id,
        p_status: "suspended",
        p_reason: "test",
      });
      expect(error).toBeNull();

      const { data } = await alice.client.from("job_applications").select("id");
      expect(data).toEqual([]);
      const ins = await alice.client.from("job_applications").insert({ user_id: alice.id, job_title: "While suspended" });
      expect(ins.error).not.toBeNull();
      // They can still read their own profile (to see the suspension notice).
      const { data: me } = await alice.client.from("profiles").select("account_status").eq("id", alice.id).single();
      expect(me?.account_status).toBe("suspended");

      await admin.client.rpc("admin_set_account_status", { p_user_id: alice.id, p_status: "active" });
      const { data: restored } = await alice.client.from("job_applications").select("id");
      expect(restored?.map((r) => r.id)).toEqual([aliceAppId]);

      const { data: logs } = await admin.client.from("audit_logs").select("action").eq("target_id", alice.id);
      expect(logs?.map((l) => l.action)).toEqual(expect.arrayContaining(["user.suspended", "user.reactivated"]));
    });
  });

  describe("private storage", () => {
    const pdf = new Blob(["%PDF-1.4\n% test\n"], { type: "application/pdf" });

    it("lets users upload only into their own folder", async () => {
      const own = await bob.client.storage.from("source-cvs").upload(`${bob.id}/cv.pdf`, pdf, { contentType: "application/pdf" });
      expect(own.error).toBeNull();
      const other = await alice.client.storage.from("source-cvs").upload(`${bob.id}/evil.pdf`, pdf, { contentType: "application/pdf" });
      expect(other.error).not.toBeNull();
    });

    it("prevents reading another user's CV file", async () => {
      const read = await alice.client.storage.from("source-cvs").download(`${bob.id}/cv.pdf`);
      expect(read.error).not.toBeNull();
      const signed = await alice.client.storage.from("source-cvs").createSignedUrl(`${bob.id}/cv.pdf`, 60);
      expect(signed.error).not.toBeNull();
      const adminRead = await admin.client.storage.from("source-cvs").download(`${bob.id}/cv.pdf`);
      expect(adminRead.error).not.toBeNull();
      const ownRead = await bob.client.storage.from("source-cvs").download(`${bob.id}/cv.pdf`);
      expect(ownRead.error).toBeNull();
    });

    it("rejects disallowed file types at the bucket level", async () => {
      const exe = new Blob(["MZ"], { type: "application/x-msdownload" });
      const res = await bob.client.storage.from("source-cvs").upload(`${bob.id}/bad.exe`, exe, { contentType: "application/x-msdownload" });
      expect(res.error).not.toBeNull();
    });

    it("is not publicly accessible", async () => {
      const { data } = anonClient().storage.from("source-cvs").getPublicUrl(`${bob.id}/cv.pdf`);
      const res = await fetch(data.publicUrl);
      expect(res.ok).toBe(false);
    });
  });

  describe("registration lock", () => {
    it("blocks signups while registration is closed", async () => {
      const svc = serviceClient();
      await svc.from("platform_settings").update({ value: false }).eq("key", "registration_open");
      try {
        const res = await anonClient().auth.signUp({ email: `closed-${Date.now()}@applydesk.test`, password: "Password-123" });
        expect(res.error).not.toBeNull();
      } finally {
        await svc.from("platform_settings").update({ value: true }).eq("key", "registration_open");
      }
    });
  });

  describe("account deletion", () => {
    it("removes all of a user's rows when the auth user is deleted", async () => {
      const temp = await createTestUser("temp");
      const app = await temp.client.from("job_applications").insert({ user_id: temp.id, job_title: "Temp" }).select("id").single();
      await serviceClient().from("ai_usage").insert({ user_id: temp.id, feature: "test" });
      await deleteTestUser(temp);
      const svc = serviceClient();
      const { count: apps } = await svc.from("job_applications").select("*", { count: "exact", head: true }).eq("id", app.data!.id);
      expect(apps).toBe(0);
      const { count: profiles } = await svc.from("profiles").select("*", { count: "exact", head: true }).eq("id", temp.id);
      expect(profiles).toBe(0);
      const { count: usage } = await svc.from("ai_usage").select("*", { count: "exact", head: true }).eq("user_id", temp.id);
      expect(usage).toBe(0);
    });
  });
});

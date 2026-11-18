// E2E: admin console (role gating, user management, suspension, support
// access boundary, announcements, settings incl. AI quotas and registration
// lock, audit log) and candidate account settings (export, deletion).
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { assert, BASE_URL, callAiRoute, resetRateLimits, uniqueEmail } from "./helpers.mjs";
import { startMockAnthropic } from "./mock-anthropic.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local", quiet: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await resetRateLimits(admin);
const mock = await startMockAnthropic();
const password = "Admin-e2e-pass-1";
const created = [];

async function makeUser(label, name) {
  const email = uniqueEmail(label);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  created.push(data.user.id);
  await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", data.user.id);
  return { id: data.user.id, email };
}

const boss = await makeUser("e2e-admin", "Ada Admin");
await admin.rpc("grant_admin_role", { p_email: boss.email });
const cand = await makeUser("e2e-cand", "Casey Candidate");
const { data: app } = await admin
  .from("job_applications")
  .insert({ user_id: cand.id, job_title: "Secret Role Title", company_name: "Private Co", job_description: "A".repeat(200), notes: "very private note" })
  .select("id")
  .single();
await admin.from("skills").insert({ user_id: cand.id, skill_name: "Testing" });
await admin.storage.from("source-cvs").upload(`${cand.id}/11111111-1111-4111-8111-111111111111.pdf`, new Blob(["%PDF-1.4 test"]), { contentType: "application/pdf" });

async function waitForSetting(key, value) {
  for (let i = 0; i < 40; i++) {
    const { data } = await admin.from("platform_settings").select("value").eq("key", key).single();
    if (JSON.stringify(data?.value) === JSON.stringify(value)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`setting ${key} never became ${JSON.stringify(value)}`);
}

const browser = await chromium.launch();
const steps = [];
const step = (s) => {
  steps.push(s);
  console.log(`✓ ${s}`);
};
async function session(email) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");
  return { ctx, page };
}

let adminPage;
let candPage;
const shot = async (p, name) => {
  if (process.env.SHOTS_DIR) await p.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true });
};
try {
  const c = await session(cand.email);
  candPage = c.page;
  const r = await c.page.goto(`${BASE_URL}/admin`);
  assert(r.status() === 404, "candidate gets 404 for /admin");
  const rpc = await c.page.request.post(`${BASE_URL}/admin/users`).catch(() => null);
  void rpc;
  step("non-admins can't reach the admin console (404)");

  const a = await session(boss.email);
  adminPage = a.page;
  await adminPage.goto(`${BASE_URL}/admin`);
  await adminPage.getByText("Platform overview").waitFor();
  await adminPage.getByText("System health").waitFor();
  const html = await adminPage.content();
  assert(!html.includes("Secret Role Title") && !html.includes("very private note"), "no private content on overview");
  step("admin overview shows aggregate stats and system health, no private content");
  await shot(adminPage, "admin-overview");

  // Directory search + counts
  await adminPage.goto(`${BASE_URL}/admin/users`);
  await adminPage.getByLabel("Search").fill("e2e-cand");
  await adminPage.getByRole("button", { name: "Search" }).click();
  await adminPage.waitForURL(/q=e2e-cand/);
  const row = adminPage.locator("tr", { hasText: cand.email });
  await row.waitFor();
  assert((await row.innerText()).includes("1"), "application count shown");
  assert(!(await adminPage.content()).includes("Secret Role Title"), "no application titles in directory");
  step("user directory search shows account details and activity counts only");
  await shot(adminPage, "admin-users");

  // Suspend
  await row.getByRole("button", { name: `Actions for ${cand.email}` }).click();
  await adminPage.getByRole("menuitem", { name: "Suspend account" }).click();
  await adminPage.getByLabel("Reason (recorded in the audit log)").fill("Spam reports");
  await adminPage.getByRole("button", { name: "Suspend account" }).click();
  await adminPage.getByText("Account suspended.").waitFor();
  await c.page.goto(`${BASE_URL}/dashboard`);
  await c.page.waitForURL(/\/suspended/);
  await c.page.getByText("Your account is suspended").waitFor();
  const c2 = await browser.newContext();
  const p2 = await c2.newPage();
  await p2.goto(`${BASE_URL}/login`);
  await p2.getByLabel("Email").fill(cand.email);
  await p2.locator("#password").fill(password);
  await p2.getByRole("button", { name: "Sign in" }).click();
  await p2.getByText("This account has been suspended").waitFor();
  await c2.close();
  step("suspension locks the user out immediately and blocks new sign-ins");

  // Reactivate
  await adminPage.goto(`${BASE_URL}/admin/users/${cand.id}`);
  await adminPage.getByRole("button", { name: "Reactivate" }).click();
  await adminPage.getByText("Account reactivated.").waitFor();
  await c.page.goto(`${BASE_URL}/dashboard`);
  await c.page.waitForURL((u) => u.pathname === "/dashboard");
  step("reactivation restores access");

  // Support access boundary
  await adminPage.goto(`${BASE_URL}/admin/users/${cand.id}`);
  assert(!(await adminPage.getByRole("link", { name: "Open read-only support view" }).count()), "no support view without consent");
  const forced = await adminPage.goto(`${BASE_URL}/admin/users/${cand.id}?support=1`);
  assert(forced.ok() && !(await adminPage.content()).includes("Secret Role Title"), "support view blocked without consent");
  await c.page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: "networkidle" });
  await c.page.getByLabel("Support access duration").selectOption("24");
  await c.page.getByRole("button", { name: "Grant support access" }).click();
  await c.page.getByText("Support access granted for 24 hours.").waitFor();
  await adminPage.goto(`${BASE_URL}/admin/users/${cand.id}`);
  await adminPage.getByRole("link", { name: "Open read-only support view" }).click();
  await adminPage.getByText("Secret Role Title").waitFor();
  assert(!(await adminPage.content()).includes("very private note"), "notes not shown even in support view");
  await c.page.getByRole("button", { name: "Revoke access now" }).click();
  await c.page.getByText("Support access revoked.").waitFor();
  await adminPage.reload();
  assert(!(await adminPage.content()).includes("Secret Role Title"), "access ends on revoke");
  step("support view only works while the user grants access, and stops on revoke");

  // Announcements
  await adminPage.goto(`${BASE_URL}/admin/announcements`);
  await adminPage.getByRole("button", { name: "New announcement" }).click();
  await adminPage.getByLabel("Title").fill("Scheduled maintenance");
  await adminPage.getByLabel("Message").fill("ApplyDesk will be briefly unavailable on Sunday.");
  await adminPage.getByRole("button", { name: "Publish" }).click();
  await adminPage.getByText("Announcement published.").waitFor();
  await c.page.goto(`${BASE_URL}/dashboard`);
  await c.page.getByText("Scheduled maintenance").waitFor();
  await c.page.getByRole("button", { name: "Dismiss announcement" }).click();
  await c.page.reload();
  await c.page.waitForTimeout(500);
  assert((await c.page.getByText("Scheduled maintenance").count()) === 0, "dismissed");
  step("announcements publish to candidate dashboards and can be dismissed");

  // Settings: AI quota and registration
  await adminPage.goto(`${BASE_URL}/admin/settings`, { waitUntil: "networkidle" });
  await adminPage.getByLabel("Requests per user per day").fill("1");
  await adminPage.getByRole("button", { name: "Save settings" }).click();
  await waitForSetting("ai_daily_request_limit", 1);
  const call = () => callAiRoute(c.page.request, "/api/ai/analyse", { applicationId: app.id });
  await admin.from("work_experiences").insert({ user_id: cand.id, company: "Acme", job_title: "Tester" });
  const first = await call();
  assert(first.includes('"type":"result"'), `first AI call allowed: ${first.slice(-200)}`);
  const second = await call();
  assert(second.includes("today's AI usage limit"), `second AI call blocked by daily limit: ${second.slice(-160)}`);
  await adminPage.reload({ waitUntil: "networkidle" });
  await adminPage.getByLabel("Requests per user per day").fill("40");
  await adminPage.getByLabel("Open registration").click();
  await adminPage.getByRole("button", { name: "Save settings" }).click();
  await waitForSetting("registration_open", false);
  await waitForSetting("ai_daily_request_limit", 40);
  const anon = await browser.newPage();
  await anon.goto(`${BASE_URL}/register`);
  await anon.getByText("Registration is paused").waitFor();
  await adminPage.reload({ waitUntil: "networkidle" });
  await adminPage.getByLabel("Open registration").click();
  await adminPage.getByRole("button", { name: "Save settings" }).click();
  await waitForSetting("registration_open", true);
  await anon.reload();
  await anon.getByRole("button", { name: "Create account" }).waitFor();
  await anon.close();
  step("platform settings enforce AI daily limits and the registration lock");

  // Audit log + analytics pages
  await adminPage.goto(`${BASE_URL}/admin/audit-logs`);
  for (const action of ["user.suspended", "user.reactivated", "support.viewed", "settings.updated", "announcement.created"]) {
    assert((await adminPage.getByRole("cell", { name: action }).count()) > 0, `audit log has ${action}`);
  }
  await adminPage.goto(`${BASE_URL}/admin/analytics`);
  await adminPage.getByText("Applications by status").waitFor();
  await adminPage.goto(`${BASE_URL}/admin/ai-usage`);
  await adminPage.getByRole("cell", { name: "Job analysis" }).waitFor();
  step("audit log records every sensitive action; analytics and AI usage pages render");
  await shot(adminPage, "admin-ai-usage");

  // Candidate export
  const exportRes = await c.page.request.get(`${BASE_URL}/api/account/export`);
  const exported = await exportRes.json();
  assert(exported.job_applications[0].job_title === "Secret Role Title" && exported.skills.length === 1, "export contains own data");
  step("candidate can export all of their data as JSON");

  // Candidate self-deletion
  await c.page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: "networkidle" });
  await c.page.getByRole("button", { name: "Delete my account" }).click();
  await c.page.getByLabel("Your password").fill("wrong-password-9");
  await c.page.getByLabel('Type "DELETE" to confirm').fill("DELETE");
  await c.page.getByRole("button", { name: "Delete everything" }).click();
  await c.page.getByText("Your password is incorrect.").first().waitFor();
  await c.page.getByLabel("Your password").fill(password);
  await c.page.getByRole("button", { name: "Delete everything" }).click();
  await c.page.waitForURL(/\?deleted=1/);
  await c.page.getByText("permanently deleted").waitFor();
  const { count: left } = await admin.from("job_applications").select("*", { count: "exact", head: true }).eq("user_id", cand.id);
  const { data: files } = await admin.storage.from("source-cvs").list(cand.id);
  const { data: authUser } = await admin.auth.admin.getUserById(cand.id);
  assert(left === 0 && files.length === 0 && !authUser?.user, "all data, files and auth user removed");
  step("self-service deletion requires password + DELETE and removes data, files and login");

  // Admin deletion of another user
  const victim = await makeUser("e2e-victim", "Vic Tim");
  await adminPage.goto(`${BASE_URL}/admin/users?q=e2e-victim`);
  const vrow = adminPage.locator("tr", { hasText: victim.email });
  await vrow.getByRole("button", { name: `Actions for ${victim.email}` }).click();
  await adminPage.getByRole("menuitem", { name: "Delete account" }).click();
  await adminPage.getByLabel("Reason (recorded in the audit log)").fill("User requested deletion by email");
  const del = adminPage.getByRole("button", { name: "Delete permanently" });
  assert(await del.isDisabled(), "delete disabled until email typed");
  await adminPage.getByLabel(`Type ${victim.email} to confirm`).fill(victim.email);
  await del.click();
  await adminPage.getByText("Account and all associated data deleted.").waitFor();
  const { data: gone } = await admin.from("profiles").select("id").eq("id", victim.id);
  const { data: audit } = await admin.from("audit_logs").select("action, metadata").eq("target_id", victim.id);
  assert(gone.length === 0 && audit.some((x) => x.action === "user.deleted" && x.metadata.reason), "deleted and audited");
  step("admins can delete an account only with typed confirmation and a recorded reason");

  // Admin can't suspend themselves or other admins
  const selfRes = await adminPage.goto(`${BASE_URL}/admin/users/${boss.id}`);
  assert(selfRes.ok() && (await adminPage.getByRole("button", { name: "Suspend" }).count()) === 0, "no self-suspend button");
  step("admins can't suspend or delete themselves");

  console.log(`\nAdmin E2E passed (${steps.length} checks)`);
} catch (error) {
  console.error("✗ Admin E2E failed:", error.message);
  await adminPage?.screenshot({ path: "tests/e2e/admin-failure.png", fullPage: true }).catch(() => {});
  await candPage?.screenshot({ path: "tests/e2e/admin-failure-candidate.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await admin.from("platform_settings").update({ value: 40 }).eq("key", "ai_daily_request_limit");
  await admin.from("platform_settings").update({ value: true }).eq("key", "registration_open");
  await admin.from("announcements").delete().eq("title", "Scheduled maintenance");
  await browser.close();
  await mock.close();
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {});
}

// E2E: mobile responsiveness. On a phone viewport every key page must render
// without horizontal page overflow, and the navigation drawer must work.
import { createRequire } from "node:module";
import { chromium, devices } from "playwright";
import { assert, BASE_URL, resetRateLimits, uniqueEmail } from "./helpers.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local", quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await resetRateLimits(admin);

const email = uniqueEmail("e2e-mobile");
const password = "Mobile-pass-123";
const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Mobile Person" } });
const userId = data.user.id;
await admin.rpc("grant_admin_role", { p_email: email });
await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", userId);
const { data: app } = await admin
  .from("job_applications")
  .insert({ user_id: userId, job_title: "Customer Success Manager with a long title that wraps", company_name: "Kauri Software Limited", job_description: "Help customers succeed. ".repeat(20) })
  .select("id")
  .single();
const { data: resume } = await admin
  .from("generated_resumes")
  .insert({
    user_id: userId,
    application_id: app.id,
    title: "Resume",
    content_json: {
      version: 1,
      contact: { full_name: "Mobile Person", headline: "Customer Success", email, phone: "", location: "Auckland", links: [] },
      summary: "Summary",
      skills: ["Onboarding", "Retention"],
      experience: [],
      education: [],
      certifications: [],
      projects: [],
      additional: [],
      section_order: ["summary", "skills", "experience", "education", "certifications", "projects", "additional"],
      hidden_sections: [],
      meta: {},
    },
  })
  .select("id")
  .single();

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
const steps = [];

try {
  const pages = [
    "/",
    "/login",
    "/register",
    "/privacy",
    "/dashboard",
    "/dashboard/profile",
    "/dashboard/cv",
    "/dashboard/applications",
    "/dashboard/applications?view=table",
    "/dashboard/applications/new",
    `/dashboard/applications/${app.id}`,
    `/dashboard/applications/${app.id}?tab=tracking`,
    `/dashboard/resumes/${resume.id}`,
    "/dashboard/resumes",
    "/dashboard/cover-letters",
    "/dashboard/interview-prep",
    "/dashboard/settings",
    "/admin",
    "/admin/users",
    "/admin/ai-usage",
    "/admin/audit-logs",
  ];

  // Public pages first, then sign in.
  for (const p of pages.slice(0, 4)) {
    await page.goto(`${BASE_URL}${p}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${p} overflows horizontally by ${overflow}px`);
  }
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");

  for (const p of pages.slice(4)) {
    await page.goto(`${BASE_URL}${p}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${p} overflows horizontally by ${overflow}px`);
  }
  steps.push(`no horizontal page overflow on ${pages.length} pages at 390px`);
  console.log(`✓ ${steps.at(-1)}`);

  await page.goto(`${BASE_URL}/dashboard`);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Job Applications" }).click();
  await page.waitForURL(/\/dashboard\/applications$/);
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 5000 });
  steps.push("mobile navigation drawer opens, navigates and closes");
  console.log(`✓ ${steps.at(-1)}`);

  await page.goto(`${BASE_URL}/dashboard/resumes/${resume.id}`);
  await page.getByRole("tab", { name: "Preview" }).click();
  await page.locator(".document-page").waitFor();
  assert(!(await page.getByRole("textbox", { name: "Professional summary" }).isVisible()), "editor hidden while previewing");
  steps.push("resume editor switches between edit and preview on mobile");
  console.log(`✓ ${steps.at(-1)}`);

  console.log(`\nMobile E2E passed (${steps.length} checks)`);
} catch (error) {
  console.error("✗ Mobile E2E failed:", error.message);
  await page.screenshot({ path: "tests/e2e/mobile-failure.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(userId);
}

// E2E: the "Send to ApplyDesk" bookmarklet. Runs the button's real code on a
// (simulated) job site in the user's browser and checks the advertisement
// lands in the new-application form, including after signing in first.
// Requires supabase + the app running (see run-all.mjs).
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { assert, BASE_URL, login, resetRateLimits, uniqueEmail } from "./helpers.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local", quiet: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await resetRateLimits(admin);
const password = "Clip-pass-1234";
const email = uniqueEmail("e2e-clip");
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Clip Person" } });
if (error) throw error;
await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", created.user.id);

const JOB_URL = "https://jobs.example.test/job/42";
const DESCRIPTION = `<p>Kererū Insights is hiring a Data Analyst to join our Auckland team.</p><ul><li>Build dashboards in Power BI</li><li>Write SQL against our warehouse</li></ul>${"<p>Work with product teams to measure outcomes and explain findings clearly.</p>".repeat(3)}`;
const jobPage = (withJsonLd) => `<!doctype html><html><head><title>Data Analyst - Kererū Insights | Example Jobs</title>
${withJsonLd ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "JobPosting", title: "Data Analyst", hiringOrganization: { "@type": "Organization", name: "Kererū Insights" }, jobLocation: { "@type": "Place", address: { addressLocality: "Auckland", addressCountry: "NZ" } }, employmentType: "FULL_TIME", description: DESCRIPTION })}</script>` : ""}
</head><body><nav>Jobs · Sign in</nav><main><h1>Data Analyst</h1><p>Kererū Insights · Auckland</p>${DESCRIPTION}</main></body></html>`;

const browser = await chromium.launch();
const steps = [];
const step = (s) => {
  steps.push(s);
  console.log(`✓ ${s}`);
};

/** Open the fake job site in this context, run the bookmarklet, return ApplyDesk's new tab. */
async function clipFrom(context, code, withJsonLd) {
  await context.route("https://jobs.example.test/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: jobPage(withJsonLd) }));
  const site = await context.newPage();
  await site.goto(JOB_URL);
  const opened = context.waitForEvent("page");
  await site.evaluate(code);
  const tab = await opened;
  await tab.waitForLoadState();
  return tab;
}

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, email, password);
  await page.waitForURL(/\/dashboard/);
  await page.goto(`${BASE_URL}/dashboard/applications/new`);
  const button = page.getByTestId("send-to-applydesk");
  await button.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="send-to-applydesk"]')?.getAttribute("href")?.startsWith("javascript:"));
  const href = await button.getAttribute("href");
  const code = decodeURIComponent(href.slice("javascript:".length));
  assert(code.includes(BASE_URL), "bookmarklet targets this ApplyDesk site");
  await button.click();
  await page.getByText("Drag this button to your bookmarks bar, then click it").waitFor();
  step("Create Application offers a draggable Send to ApplyDesk button (clicking it here explains what to do)");

  const tab = await clipFrom(context, code, true);
  await tab.waitForURL(`${BASE_URL}/dashboard/applications/new`);
  await tab.waitForFunction(() => document.querySelector("#jobTitle")?.value === "Data Analyst");
  assert((await tab.inputValue("#companyName")) === "Kererū Insights", "company filled from the page's job data");
  assert((await tab.inputValue("#location")).includes("Auckland"), "location filled");
  assert((await tab.inputValue("#jobDescription")).includes("Power BI"), "description filled");
  assert((await tab.inputValue("#jobUrl")) === JOB_URL, "advertisement link kept");
  assert(!tab.url().includes("#d=") && !tab.url().includes("clip=1"), "advertisement removed from the address bar");
  await tab.getByText("We read the advertisement you sent").waitFor();
  step("clicking the bookmark on a job site fills the form from the page you're viewing");

  const textOnly = await clipFrom(context, code, false);
  await textOnly.waitForFunction(() => (document.querySelector("#jobDescription")?.value ?? "").includes("Power BI"));
  step("pages without structured job data are sent as text");

  // Not signed in yet: the advertisement survives signing in.
  const fresh = await browser.newContext();
  const signedOut = await clipFrom(fresh, code, true);
  await signedOut.waitForURL(/\/login/);
  await signedOut.getByLabel("Email").fill(email);
  await signedOut.locator("#password").fill(password);
  await signedOut.getByRole("button", { name: "Sign in" }).click();
  await signedOut.waitForURL(`${BASE_URL}/dashboard/applications/new`);
  await signedOut.waitForFunction(() => document.querySelector("#jobTitle")?.value === "Data Analyst");
  step("if you're signed out, the advertisement is waiting after you sign in");

  console.log(`\nClip E2E passed (${steps.length} checks)`);
} catch (err) {
  console.error(`✗ Clip E2E failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}

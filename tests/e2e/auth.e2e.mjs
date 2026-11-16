// E2E: registration, email verification, logout, login, protected routes,
// password reset. Run: node tests/e2e/auth.e2e.mjs (dev server + supabase running)
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { assert, BASE_URL, extractLink, login, resetRateLimits, uniqueEmail, waitForEmail } from "./helpers.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local", quiet: true });
await resetRateLimits(createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }));

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const email = uniqueEmail("e2e-auth");
const password = "Sup3r-secret-pw";
const steps = [];
const step = (s) => {
  steps.push(s);
  console.log(`✓ ${s}`);
};

try {
  // Unauthenticated access is redirected to login with a safe `next`.
  await page.goto(`${BASE_URL}/dashboard/applications`);
  assert(page.url().includes("/login?next=%2Fdashboard%2Fapplications"), "protected route redirects to login");
  step("protected route redirects anonymous users to /login");

  // Validation errors show without a network round-trip.
  await page.goto(`${BASE_URL}/register`);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Enter your full name.").waitFor();
  step("registration form validates required fields");

  // Sign in before verifying -> blocked.
  await page.getByLabel("Full name").fill("Erin Example");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.locator("#acceptTerms").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/verify-email/);
  step("registration succeeds and asks the user to verify");

  await login(page, email, password);
  await page.getByText("Please confirm your email address first").waitFor();
  step("unverified users cannot sign in");

  const html = await waitForEmail(email, { subjectIncludes: "Confirm" });
  await page.goto(extractLink(html, "/auth/confirm"));
  await page.waitForURL(/\/onboarding/);
  step("email verification link signs the user in and opens onboarding");

  // Sign out
  await page.evaluate(async () => {
    await fetch("/auth/signout", { method: "POST" });
  });
  await page.goto(`${BASE_URL}/dashboard`);
  assert(page.url().includes("/login"), "signed out");
  step("sign out clears the session");

  // Wrong password
  await login(page, email, "wrong-password-1");
  await page.getByText("Incorrect email or password.").waitFor();
  step("wrong password shows a generic error");

  // Correct login honours a safe `next` but ignores an open redirect.
  await page.goto(`${BASE_URL}/login?next=//evil.example.com`);
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard" || u.pathname === "/onboarding");
  assert(new URL(page.url()).host === new URL(BASE_URL).host, "open redirect blocked");
  step("login works and blocks open redirects");

  // Authenticated users visiting /login are sent into the app (dashboard, or
  // onboarding for this not-yet-onboarded user).
  await page.goto(`${BASE_URL}/login`);
  await page.waitForURL((u) => u.pathname === "/dashboard" || u.pathname === "/onboarding");
  step("signed-in users skip the login page");

  // Password reset
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE_URL}/forgot-password`);
  await p2.getByLabel("Email").fill(email);
  await p2.getByRole("button", { name: "Send reset link" }).click();
  await p2.getByText("Check your email").waitFor();
  const resetHtml = await waitForEmail(email, { subjectIncludes: "Reset" });
  await p2.goto(extractLink(resetHtml, "/auth/confirm"));
  await p2.waitForURL(/\/reset-password/);
  const newPassword = "N3w-secret-pw";
  await p2.getByLabel("New password", { exact: true }).fill(newPassword);
  await p2.getByLabel("Confirm new password").fill(newPassword);
  await p2.getByRole("button", { name: "Update password" }).click();
  await p2.waitForURL((u) => u.pathname.startsWith("/dashboard") || u.pathname === "/onboarding");
  await ctx2.close();
  step("password reset email + link + new password works");

  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  await login(p3, email, newPassword);
  await p3.waitForURL((u) => u.pathname !== "/login");
  await ctx3.close();
  step("new password signs in");

  console.log(`\nAuth E2E passed (${steps.length} checks)`);
} catch (error) {
  console.error("✗ Auth E2E failed:", error.message);
  await page.screenshot({ path: "tests/e2e/auth-failure.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}

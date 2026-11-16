// Shared helpers for the Playwright end-to-end scripts.
// The E2E suite drives a real browser against `next dev` + local Supabase
// (with Mailpit capturing auth emails).

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function uniqueEmail(label) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@applydesk.test`;
}

/** Poll Mailpit for the newest email sent to `to` and return its HTML body. */
export async function waitForEmail(to, { subjectIncludes, timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (res.ok) {
      const body = await res.json();
      const msg = (body.messages ?? []).find((m) => !subjectIncludes || m.Subject.includes(subjectIncludes));
      if (msg) {
        const full = await (await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`)).json();
        return full.HTML ?? full.Text ?? "";
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email to ${to} within ${timeoutMs}ms`);
}

export function extractLink(html, pathFragment) {
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));
  const link = links.find((l) => l.includes(pathFragment));
  if (!link) throw new Error(`No link containing ${pathFragment}`);
  return link;
}

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export async function registerAndVerify(page, { name, email, password }) {
  await page.goto(`${BASE_URL}/register`);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.locator("#acceptTerms").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/verify-email/);
  const html = await waitForEmail(email, { subjectIncludes: "Confirm" });
  const link = extractLink(html, "/auth/confirm");
  await page.goto(link);
}

export async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

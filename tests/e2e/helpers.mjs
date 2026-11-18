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

/**
 * Test-only: clear rate-limit counters so back-to-back suite runs from the
 * same IP don't trip the (intentional) login/AI limits.
 */
export async function resetRateLimits(adminClient) {
  const { error } = await adminClient.from("rate_limits").delete().neq("key", "");
  if (error) throw new Error(`could not reset rate limits: ${error.message}`);
}

/**
 * Call an AI route the way the browser hook does: if the route hands its model
 * call to the edge runner ("defer"), wait at /api/ai-run, then repeat the
 * request with the run id. Returns the final NDJSON text of the route.
 */
export async function callAiRoute(request, path, data) {
  const headers = { origin: BASE_URL, "content-type": "application/json" };
  let payload = data;
  for (let step = 0; step < 4; step++) {
    const text = await (await request.post(`${BASE_URL}${path}`, { headers, data: payload })).text();
    const defer = text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .find((e) => e.type === "defer");
    if (!defer) return text;
    const waited = await (await request.post(`${BASE_URL}/api/ai-run`, { headers, data: { runId: defer.runId, token: defer.token } })).text();
    if (!waited.includes('"type":"done"')) return waited;
    payload = { ...data, aiRunId: defer.runId };
  }
  throw new Error("AI route kept deferring");
}

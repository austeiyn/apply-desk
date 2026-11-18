// E2E: the AI hand-off to the edge runner (/api/ai-run). Routes store the
// prepared model request and return a one-time ticket; the runner calls the
// model; repeating the route request with the run id completes it.
// Checks the ticket is bound to its token, origin and owner, is single-use,
// and that stored prompt data is deleted once the result is saved.
// Requires supabase + the app running with the mock AI (see run-all.mjs).
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { assert, BASE_URL, login, resetRateLimits, uniqueEmail } from "./helpers.mjs";
import { startMockAnthropic } from "./mock-anthropic.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local", quiet: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await resetRateLimits(admin);
const mock = await startMockAnthropic();
const password = "Runner-pass-1234";

async function makeUser(label) {
  const email = uniqueEmail(label);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Runner Person" } });
  if (error) throw error;
  await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", data.user.id);
  return { id: data.user.id, email };
}

const owner = await makeUser("e2e-runner");
const intruder = await makeUser("e2e-runner-other");
await admin.from("work_experiences").insert({ user_id: owner.id, company: "Acme", job_title: "Web Developer", start_date: "2020-01-01", is_current: true, technologies: [] });
const { data: app, error: appError } = await admin
  .from("job_applications")
  .insert({ user_id: owner.id, job_title: "Senior Web Developer", company_name: "Example Ltd", job_description:
      "We're looking for a Senior Web Developer to build accessible WordPress sites for public-sector clients. You'll champion WCAG 2.1, mentor developers and work closely with clients. Required: 5+ years of PHP and JavaScript, strong WordPress theme development. Nice to have: React." })
  .select("id")
  .single();
if (appError) throw appError;

const browser = await chromium.launch();
const steps = [];
const step = (s) => {
  steps.push(s);
  console.log(`✓ ${s}`);
};
const json = { origin: BASE_URL, "content-type": "application/json" };
const events = (text) =>
  text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

try {
  const ownerCtx = await browser.newContext();
  const page = await ownerCtx.newPage();
  await login(page, owner.email, password);
  const intruderCtx = await browser.newContext();
  const other = await intruderCtx.newPage();
  await login(other, intruder.email, password);

  const first = events(await (await page.request.post(`${BASE_URL}/api/ai/analyse`, { headers: json, data: { applicationId: app.id } })).text());
  const defer = first.find((e) => e.type === "defer");
  if (!defer) console.log("route events:", JSON.stringify(first));
  assert(defer && /^[A-Za-z0-9_-]{43}$/.test(defer.token), "route hands the model call to the runner with a one-time token");
  assert(!first.some((e) => e.type === "result"), "nothing is saved before the model has run");
  const { data: stored } = await admin.from("ai_runs").select("status, token_hash, user_id").eq("id", defer.runId).single();
  assert(stored.status === "pending" && stored.user_id === owner.id && stored.token_hash !== defer.token, "run stored as pending with only a hash of the token");
  step("route stores the prepared request and returns a one-time ticket");

  const wrongToken = await page.request.post(`${BASE_URL}/api/ai-run`, { headers: json, data: { runId: defer.runId, token: "A".repeat(43) } });
  assert(wrongToken.status() === 404, `wrong token rejected (got ${wrongToken.status()})`);
  const crossOrigin = await page.request.post(`${BASE_URL}/api/ai-run`, {
    headers: { ...json, origin: "https://evil.example" },
    data: { runId: defer.runId, token: defer.token },
  });
  assert(crossOrigin.status() === 403, `cross-origin runner call rejected (got ${crossOrigin.status()})`);
  const malformed = await page.request.post(`${BASE_URL}/api/ai-run`, { headers: json, data: { runId: "not-a-uuid", token: defer.token } });
  assert(malformed.status() === 400, "malformed ticket rejected");
  step("runner rejects wrong tokens, other origins and malformed tickets");

  const ran = events(await (await page.request.post(`${BASE_URL}/api/ai-run`, { headers: json, data: { runId: defer.runId, token: defer.token } })).text());
  assert(ran.at(-1)?.type === "done", `runner finishes the model call: ${JSON.stringify(ran.at(-1))}`);
  const again = await page.request.post(`${BASE_URL}/api/ai-run`, { headers: json, data: { runId: defer.runId, token: defer.token } });
  assert(again.status() === 404, "ticket can only be used once");
  step("runner calls the model once and the ticket can't be reused");

  // Another user can't redeem the finished run: it isn't theirs, so their
  // request is treated as new (and fails on the application they can't see).
  const stolen = await (await other.request.post(`${BASE_URL}/api/ai/analyse`, { headers: json, data: { applicationId: app.id, aiRunId: defer.runId } })).text();
  assert(stolen.includes("couldn't find") && !stolen.includes('"type":"result"'), "another user can't use the run");
  const { data: stillThere } = await admin.from("ai_runs").select("status").eq("id", defer.runId).single();
  assert(stillThere?.status === "done", "the owner's finished run is untouched");
  step("a finished run can't be redeemed by another user");

  const done = events(await (await page.request.post(`${BASE_URL}/api/ai/analyse`, { headers: json, data: { applicationId: app.id, aiRunId: defer.runId } })).text());
  assert(done.some((e) => e.type === "result"), `owner completes the request: ${JSON.stringify(done.at(-1))}`);
  const { data: saved } = await admin.from("job_applications").select("job_analysis").eq("id", app.id).single();
  assert(saved.job_analysis, "analysis saved");
  const { data: leftover } = await admin.from("ai_runs").select("id").eq("id", defer.runId);
  assert(leftover.length === 0, "prompt data deleted after the result is saved");
  const { data: usage } = await admin.from("ai_usage").select("status").eq("user_id", owner.id);
  assert(usage.length === 1 && usage[0].status === "success", `metered exactly once (got ${usage.length})`);
  assert(mock.requests.length === 1, `model called exactly once (got ${mock.requests.length})`);
  step("repeating the request saves the result, meters once and deletes the stored prompt");

  console.log(`\nAI runner E2E passed (${steps.length} checks)`);
} catch (error) {
  console.error(`✗ AI runner E2E failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  await mock.close();
}

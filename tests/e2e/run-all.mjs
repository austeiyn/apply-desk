// Runs every end-to-end suite in sequence.
//
// Prerequisites (see README "Testing"):
//   1. supabase start                       (local Supabase incl. Mailpit)
//   2. ANTHROPIC_API_KEY=test-key ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev
//      (the suites start a mock Anthropic API on port 4010 themselves)
import { spawnSync } from "node:child_process";

const suites = ["auth.e2e.mjs", "profile-cv.e2e.mjs", "applications.e2e.mjs", "admin.e2e.mjs", "mobile.e2e.mjs", "location.e2e.mjs"];
let failed = 0;
for (const suite of suites) {
  console.log(`\n━━ ${suite} ━━`);
  const res = spawnSync(process.execPath, [`tests/e2e/${suite}`], { stdio: "inherit" });
  if (res.status !== 0) failed++;
}
console.log(failed ? `\n${failed} suite(s) failed` : "\nAll E2E suites passed");
process.exit(failed ? 1 : 0);

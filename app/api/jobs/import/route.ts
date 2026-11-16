import { assertSameOrigin, jsonError } from "@/lib/ai/stream";
import { AuthorizationError, requireActiveUserForAction } from "@/lib/auth/session";
import { extractJobFromHtml, looksBlocked } from "@/lib/jobs/extract";
import { fetchJobPage, JobFetchError } from "@/lib/jobs/fetch-page";
import { JOB_IMPORT_FALLBACK_MESSAGE } from "@/lib/jobs/messages";
import { rateLimit } from "@/lib/rate-limit";
import { importUrlSchema } from "@/lib/validation/application";

const FALLBACK_MESSAGE = JOB_IMPORT_FALLBACK_MESSAGE;

/**
 * Server-side retrieval of a public job advertisement. Returns extracted,
 * plain-text fields for the user to review; nothing is saved here.
 */
export async function POST(request: Request) {
  let userId: string;
  try {
    assertSameOrigin(request);
    ({ userId } = await requireActiveUserForAction());
  } catch (e) {
    return jsonError(e instanceof AuthorizationError ? e.message : "Unauthorized", 401);
  }

  const parsed = importUrlSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Paste a job advertisement link.", 400);

  if (!(await rateLimit(`job-import:${userId}`, 15, 300))) {
    return Response.json({ ok: false, reason: "rate_limited", message: "You're importing links very quickly. Wait a few minutes and try again." }, { status: 429 });
  }

  try {
    const page = await fetchJobPage(parsed.data.url);
    if (looksBlocked(page.html)) {
      return Response.json({
        ok: false,
        reason: "access_denied",
        message: `This site requires signing in or verifies visitors before showing the advertisement. ${FALLBACK_MESSAGE}`,
      });
    }
    const job = extractJobFromHtml(page.html);
    if (job.description.replace(/\s/g, "").length < 200) {
      return Response.json({ ok: false, reason: "no_content", message: FALLBACK_MESSAGE, partial: { jobTitle: job.jobTitle, companyName: job.companyName } });
    }
    return Response.json({ ok: true, url: page.url, job });
  } catch (error) {
    if (error instanceof JobFetchError) {
      const userFacing = ["invalid_url", "blocked_address"].includes(error.reason) ? error.message : `${error.message} ${FALLBACK_MESSAGE}`;
      return Response.json({ ok: false, reason: error.reason, message: userFacing });
    }
    console.error("[job-import] unexpected error", error);
    return Response.json({ ok: false, reason: "network", message: FALLBACK_MESSAGE });
  }
}

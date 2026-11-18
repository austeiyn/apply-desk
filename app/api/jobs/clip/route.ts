import { z } from "zod";
import { assertSameOrigin, jsonError } from "@/lib/ai/stream";
import { AuthorizationError, requireActiveUserForAction } from "@/lib/auth/session";
import { jobFromClip } from "@/lib/jobs/clip";
import { JOB_IMPORT_FALLBACK_MESSAGE } from "@/lib/jobs/messages";
import { rateLimit } from "@/lib/rate-limit";

const clipSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => {
      try {
        return ["http:", "https:"].includes(new URL(v).protocol);
      } catch {
        return false;
      }
    }),
  title: z.string().max(1000).default(""),
  ld: z.array(z.string().max(60_000)).max(10).default([]),
  text: z.string().max(100_000).default(""),
});

/**
 * Extract job fields from an advertisement the user sent from their own
 * browser with the bookmarklet. Returns the same shape as /api/jobs/import;
 * nothing is saved here.
 */
export async function POST(request: Request) {
  let userId: string;
  try {
    assertSameOrigin(request);
    ({ userId } = await requireActiveUserForAction());
  } catch (e) {
    return jsonError(e instanceof AuthorizationError ? e.message : "Unauthorized", 401);
  }

  const parsed = clipSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_clip", message: JOB_IMPORT_FALLBACK_MESSAGE }, { status: 400 });

  if (!(await rateLimit(`job-import:${userId}`, 15, 300))) {
    return Response.json({ ok: false, reason: "rate_limited", message: "You're importing advertisements very quickly. Wait a few minutes and try again." }, { status: 429 });
  }

  const job = jobFromClip(parsed.data);
  if (job.description.replace(/\s/g, "").length < 200) {
    return Response.json({ ok: false, reason: "no_content", message: JOB_IMPORT_FALLBACK_MESSAGE, partial: { jobTitle: job.jobTitle, companyName: job.companyName } });
  }
  return Response.json({ ok: true, url: parsed.data.url, job });
}

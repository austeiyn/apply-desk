import { z } from "zod";
import { extractCvProfile } from "@/lib/ai/cv-extractor";
import { AiError } from "@/lib/ai/errors";
import { assertSameOrigin, jsonError, streamJob } from "@/lib/ai/stream";
import { AuthorizationError, requireActiveUserForAction } from "@/lib/auth/session";

const bodySchema = z.object({ cvId: z.uuid() });

export async function POST(request: Request) {
  let session;
  try {
    assertSameOrigin(request);
    session = await requireActiveUserForAction();
  } catch (e) {
    return jsonError(e instanceof AuthorizationError ? e.message : "Unauthorized", 401);
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request.", 400);

  const { supabase, userId } = session;
  const { cvId } = parsed.data;

  return streamJob(async (progress) => {
    const { data: cv } = await supabase
      .from("source_cvs")
      .select("id, extracted_text")
      .eq("id", cvId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!cv) throw new AiError("not_found");
    if (!cv.extracted_text) throw new AiError("invalid_input", "This CV has no extracted text to analyse.");

    progress("Reading your CV…");
    try {
      const extraction = await extractCvProfile(userId, cv.extracted_text, cv.id);
      progress("Organising what we found…");
      const { error } = await supabase
        .from("source_cvs")
        .update({ parsed_data: extraction, extraction_status: "parsed", extraction_error: null })
        .eq("id", cv.id)
        .eq("user_id", userId);
      if (error) throw error;
      return {
        cvId: cv.id,
        counts: {
          experiences: extraction.work_experiences.length,
          education: extraction.education.length,
          skills: extraction.skills.length,
        },
      };
    } catch (error) {
      if (error instanceof AiError && !["duplicate", "rate_limited", "quota_daily", "quota_monthly", "not_configured", "disabled"].includes(error.code)) {
        await supabase.from("source_cvs").update({ extraction_error: error.userMessage.slice(0, 1000) }).eq("id", cv.id).eq("user_id", userId);
      }
      throw error;
    }
  });
}

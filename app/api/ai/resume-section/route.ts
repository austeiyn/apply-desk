import { z } from "zod";
import { AiError } from "@/lib/ai/errors";
import { regenerateResumeSection } from "@/lib/ai/resume-generator";
import { handleAiRoute } from "@/lib/ai/route";
import { getOwnedApplication } from "@/lib/data/applications";
import { getCandidateBundle } from "@/lib/data/profile";
import { ResumeContentSchema } from "@/lib/resume/types";

const body = z.object({
  resumeId: z.uuid(),
  section: z.enum(["summary", "skills", "experience"]),
  itemId: z.string().max(64).optional(),
  instructions: z.string().max(500).optional(),
  /** The editor's current (possibly unsaved) content, validated server-side. */
  content: ResumeContentSchema,
});

export async function POST(request: Request) {
  return handleAiRoute(request, body, async ({ session, body, progress }) => {
    const { supabase, userId } = session;
    const { data: resume } = await supabase
      .from("generated_resumes")
      .select("id, application_id")
      .eq("id", body.resumeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!resume) throw new AiError("not_found");
    if (body.section === "experience") {
      const item = body.content.experience.find((e) => e.id === body.itemId);
      if (!item?.source_id) throw new AiError("invalid_input", "This role isn't linked to your profile, so it can't be regenerated. Edit it directly instead.");
    }
    progress("Rewriting this section…");
    const [bundle, application] = await Promise.all([
      getCandidateBundle(supabase, userId),
      resume.application_id ? getOwnedApplication(supabase, userId, resume.application_id) : Promise.resolve(null),
    ]);
    return regenerateResumeSection({
      userId,
      bundle,
      application,
      current: body.content,
      section: body.section,
      itemId: body.itemId,
      instructions: body.instructions,
    });
  });
}

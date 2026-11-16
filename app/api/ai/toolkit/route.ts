import { z } from "zod";
import {
  generateApplicationAnswers,
  generateApplicationEmail,
  generateFollowUpEmail,
  generateProfessionalSummary,
  generateSkillGap,
} from "@/lib/ai/application-assistant";
import { handleAiRoute } from "@/lib/ai/route";
import { FOLLOW_UP_KIND_VALUES, FOLLOW_UP_KINDS } from "@/lib/constants";
import { loadApplicationForAi } from "@/lib/data/applications";

const body = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("application_email"), applicationId: z.uuid() }),
  z.object({ tool: z.literal("professional_summary"), applicationId: z.uuid() }),
  z.object({ tool: z.literal("application_answers"), applicationId: z.uuid(), questions: z.array(z.string().max(500)).min(1).max(10) }),
  z.object({ tool: z.literal("skill_gap"), applicationId: z.uuid() }),
  z.object({ tool: z.literal("follow_up_email"), applicationId: z.uuid(), kind: z.enum(FOLLOW_UP_KIND_VALUES), notes: z.string().max(800).default("") }),
]);

const TITLES = {
  application_email: "Application email",
  professional_summary: "Professional summary",
  application_answers: "Application question answers",
  skill_gap: "Skill gap analysis",
} as const;

export async function POST(request: Request) {
  return handleAiRoute(request, body, async ({ session, body, progress }) => {
    const { supabase, userId } = session;
    progress("Gathering your profile and the job details…");
    const { application, bundle } = await loadApplicationForAi(supabase, userId, body.applicationId);
    const ctx = { userId, bundle, application };
    progress("Writing…");

    let kind: "application_email" | "professional_summary" | "application_answers" | "skill_gap" | "follow_up_email";
    let title: string;
    let result: { data: unknown; warnings: string[] };

    switch (body.tool) {
      case "application_email": {
        const [{ data: resumes }, { data: letters }] = await Promise.all([
          supabase.from("generated_resumes").select("title").eq("user_id", userId).eq("application_id", application.id).limit(1),
          supabase.from("generated_cover_letters").select("title").eq("user_id", userId).eq("application_id", application.id).limit(1),
        ]);
        const attachments = [resumes?.length ? "tailored resume" : "", letters?.length ? "cover letter" : ""].filter(Boolean);
        result = await generateApplicationEmail(ctx, attachments);
        kind = "application_email";
        title = TITLES.application_email;
        break;
      }
      case "professional_summary":
        result = await generateProfessionalSummary(ctx);
        kind = "professional_summary";
        title = TITLES.professional_summary;
        break;
      case "application_answers":
        result = await generateApplicationAnswers(ctx, body.questions);
        kind = "application_answers";
        title = TITLES.application_answers;
        break;
      case "skill_gap":
        result = await generateSkillGap(ctx);
        kind = "skill_gap";
        title = TITLES.skill_gap;
        break;
      case "follow_up_email":
        result = await generateFollowUpEmail(ctx, body.kind, body.notes);
        kind = "follow_up_email";
        title = FOLLOW_UP_KINDS.find((k) => k.value === body.kind)?.label ?? "Follow-up email";
        break;
    }

    const { data: saved, error } = await supabase
      .from("application_materials")
      .insert({
        user_id: userId,
        application_id: application.id,
        kind,
        title,
        content_json: { ...(result.data as object), warnings: result.warnings, ...(body.tool === "follow_up_email" ? { follow_up_kind: body.kind } : {}) } as never,
      })
      .select("id")
      .single();
    if (error || !saved) throw error ?? new Error("Save failed");
    return { materialId: saved.id };
  });
}

import { z } from "zod";
import { generateCoverLetter } from "@/lib/ai/cover-letter-generator";
import { handleAiRoute } from "@/lib/ai/route";
import { COVER_LETTER_TONE_VALUES } from "@/lib/constants";
import { loadApplicationForAi } from "@/lib/data/applications";
import { ResumeContentSchema, type ResumeContent } from "@/lib/resume/types";

const body = z.object({
  applicationId: z.uuid(),
  tone: z.enum(COVER_LETTER_TONE_VALUES),
  resumeId: z.uuid().optional(),
  notes: z.string().max(800).optional(),
  /** When set, replace the content of this existing letter (keeps version count). */
  coverLetterId: z.uuid().optional(),
});

export async function POST(request: Request) {
  return handleAiRoute(request, body, async ({ session, body, progress }) => {
    const { supabase, userId } = session;
    progress("Reviewing the role and your experience…");
    const { application, bundle } = await loadApplicationForAi(supabase, userId, body.applicationId);

    // Use the chosen (or latest) tailored resume for this application as context.
    let resume: ResumeContent | null = null;
    const query = supabase.from("generated_resumes").select("content_json").eq("user_id", userId).eq("application_id", application.id);
    const { data: resumeRow } = body.resumeId
      ? await query.eq("id", body.resumeId).maybeSingle()
      : await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (resumeRow) {
      const parsed = ResumeContentSchema.safeParse(resumeRow.content_json);
      if (parsed.success) resume = parsed.data;
    }

    progress("Writing your cover letter…");
    const { content, warnings } = await generateCoverLetter({ userId, bundle, application, tone: body.tone, resume, extraNotes: body.notes });

    progress("Saving…");
    let id: string;
    if (body.coverLetterId) {
      const { data, error } = await supabase
        .from("generated_cover_letters")
        .update({ content, tone: body.tone })
        .eq("id", body.coverLetterId)
        .eq("user_id", userId)
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Update failed");
      id = data.id;
    } else {
      const title = ["Cover letter", application.job_title, application.company_name].filter(Boolean).join(" – ").slice(0, 200);
      const { data, error } = await supabase
        .from("generated_cover_letters")
        .insert({ user_id: userId, application_id: application.id, title, content, tone: body.tone, origin: "ai" })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Insert failed");
      id = data.id;
    }
    await supabase.from("application_events").insert({
      user_id: userId,
      application_id: application.id,
      event_type: "cover_letter_generated",
      description: `Cover letter (${body.tone})`,
    });
    return { coverLetterId: id, warnings };
  });
}

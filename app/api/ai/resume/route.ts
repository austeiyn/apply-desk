import { z } from "zod";
import { generateResume } from "@/lib/ai/resume-generator";
import { handleAiRoute } from "@/lib/ai/route";
import { loadApplicationForAi } from "@/lib/data/applications";
import { resumePreferencesSchema } from "@/lib/resume/types";

const body = z.object({
  applicationId: z.uuid(),
  prefs: resumePreferencesSchema,
  title: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  return handleAiRoute(request, body, async ({ session, body, progress }) => {
    const { supabase, userId } = session;
    progress("Gathering your verified experience…");
    const { application, bundle } = await loadApplicationForAi(supabase, userId, body.applicationId);
    progress("Writing your tailored resume…");
    const content = await generateResume({ userId, bundle, application, prefs: body.prefs });

    progress("Saving…");
    const { count } = await supabase
      .from("generated_resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("application_id", application.id);
    const title =
      body.title ||
      [`Resume`, application.job_title, application.company_name].filter(Boolean).join(" – ").slice(0, 190) + ((count ?? 0) > 0 ? ` (${(count ?? 0) + 1})` : "");

    const { data, error } = await supabase
      .from("generated_resumes")
      .insert({ user_id: userId, application_id: application.id, title, content_json: content as never, origin: "ai", last_change_summary: "Generated with AI" })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Insert failed");

    await supabase.from("application_events").insert({ user_id: userId, application_id: application.id, event_type: "resume_generated", description: title });
    // Make sure the user's preferences are remembered for next time.
    const { data: cp } = await supabase.from("candidate_profiles").select("preferences").eq("user_id", userId).single();
    const prefs = (cp?.preferences as Record<string, unknown> | null) ?? {};
    await supabase.from("candidate_profiles").update({ preferences: { ...prefs, resume: body.prefs } }).eq("user_id", userId);

    return { resumeId: data.id, warnings: content.meta.warnings?.length ?? 0, gaps: content.meta.skill_gaps?.length ?? 0 };
  });
}

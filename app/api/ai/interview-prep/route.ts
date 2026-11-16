import { z } from "zod";
import { generateInterviewPrep } from "@/lib/ai/interview-preparation";
import { handleAiRoute } from "@/lib/ai/route";
import { loadApplicationForAi } from "@/lib/data/applications";

const body = z.object({ applicationId: z.uuid() });

export async function POST(request: Request) {
  return handleAiRoute(request, body, async ({ session, body, progress }) => {
    const { supabase, userId } = session;
    progress("Reading the role requirements…");
    const { application, bundle } = await loadApplicationForAi(supabase, userId, body.applicationId);
    progress("Preparing questions and answers from your experience…");
    const prep = await generateInterviewPrep(userId, bundle, application);
    const content = { ...prep, generated_at: new Date().toISOString() };

    // One preparation per application; regenerating keeps the user's notes.
    const { error } = await supabase
      .from("interview_preparations")
      .upsert({ user_id: userId, application_id: application.id, content_json: content as never }, { onConflict: "application_id" });
    if (error) throw error;
    await supabase.from("application_events").insert({
      user_id: userId,
      application_id: application.id,
      event_type: "interview_prep_generated",
      description: `${prep.questions.length} interview questions prepared`,
    });
    return { questions: prep.questions.length };
  });
}

import { z } from "zod";
import { analyseJob } from "@/lib/ai/job-analyser";
import { handleAiRoute } from "@/lib/ai/route";
import { loadApplicationForAi } from "@/lib/data/applications";

const body = z.object({ applicationId: z.uuid() });

const joinList = (items: string[] | undefined) => (items?.length ? items.map((i) => `• ${i}`).join("\n") : "");

export async function POST(request: Request) {
  return handleAiRoute(request, body, async ({ session, body, progress }) => {
    const { supabase, userId } = session;
    progress("Reading the job advertisement…");
    const { application, bundle } = await loadApplicationForAi(supabase, userId, body.applicationId);
    progress("Comparing requirements with your experience…");
    const analysis = await analyseJob(userId, bundle, application);

    // Fill structured job fields the user hasn't provided (never overwrite).
    const j = analysis.job;
    const update = {
      job_analysis: analysis as unknown as never,
      analysis_updated_at: new Date().toISOString(),
      ...(!application.company_name && j.company_name ? { company_name: j.company_name.slice(0, 300) } : {}),
      ...(!application.location && j.location ? { location: j.location.slice(0, 300) } : {}),
      ...(!application.employment_type && j.employment_type ? { employment_type: j.employment_type.slice(0, 100) } : {}),
      ...(!application.salary_range && j.salary_range ? { salary_range: j.salary_range.slice(0, 200) } : {}),
      ...(!application.responsibilities && j.responsibilities.length ? { responsibilities: joinList(j.responsibilities).slice(0, 20000) } : {}),
      ...(!application.required_skills && j.required_skills.length ? { required_skills: joinList(j.required_skills).slice(0, 20000) } : {}),
      ...(!application.required_qualifications && (j.education_requirements.length || j.required_experience.length || j.certifications.length)
        ? { required_qualifications: joinList([...j.required_experience, ...j.education_requirements, ...j.certifications]).slice(0, 20000) }
        : {}),
      ...(!application.preferred_qualifications && j.preferred_skills.length ? { preferred_qualifications: joinList(j.preferred_skills).slice(0, 20000) } : {}),
    };
    const { error } = await supabase.from("job_applications").update(update).eq("id", application.id).eq("user_id", userId);
    if (error) throw error;
    await supabase.from("application_events").insert({
      user_id: userId,
      application_id: application.id,
      event_type: "analysis_completed",
      description: `Job analysed: ${analysis.overall.rating} fit`,
    });
    return { applicationId: application.id };
  });
}

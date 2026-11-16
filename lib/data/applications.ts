import "server-only";

import { AiError } from "@/lib/ai/errors";
import type { JobApplication } from "@/lib/db/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { getCandidateBundle } from "./profile";

/** Load an application owned by the user (RLS + explicit user filter). */
export async function getOwnedApplication(supabase: ServerSupabaseClient, userId: string, id: string): Promise<JobApplication | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("job_applications").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data;
}

/** Shared preconditions for AI features that work on an application. */
export async function loadApplicationForAi(supabase: ServerSupabaseClient, userId: string, applicationId: string) {
  const application = await getOwnedApplication(supabase, userId, applicationId);
  if (!application) throw new AiError("not_found");
  const description = [application.job_description, application.responsibilities, application.required_skills, application.required_qualifications].join("").trim();
  if (description.length < 80) {
    throw new AiError("invalid_input", "Add the job description first (at least a few sentences) so there's something to analyse.");
  }
  const bundle = await getCandidateBundle(supabase, userId);
  if (bundle.experiences.length === 0 && bundle.education.length === 0 && bundle.skills.length === 0) {
    throw new AiError("invalid_input", "Your profile is empty. Add your experience, education or skills (or import your CV) first.");
  }
  return { application, bundle };
}

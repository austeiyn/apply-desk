import "server-only";

import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { CandidateBundle, Profile } from "@/lib/db/types";

/**
 * Load the complete candidate profile for the signed-in user. All queries run
 * through the user's RLS-scoped client and are additionally filtered by
 * user_id (defence in depth).
 */
export async function getCandidateBundle(
  supabase: ServerSupabaseClient,
  userId: string,
  profile?: Profile,
): Promise<CandidateBundle> {
  const [p, candidate, experiences, education, skills, certifications, projects, extras] = await Promise.all([
    profile ? Promise.resolve({ data: profile }) : supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).single(),
    supabase
      .from("work_experiences")
      .select("*")
      .eq("user_id", userId)
      .order("is_current", { ascending: false })
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("sort_order"),
    supabase.from("education").select("*").eq("user_id", userId).order("graduation_date", { ascending: false, nullsFirst: true }),
    supabase.from("skills").select("*").eq("user_id", userId).order("skill_category").order("skill_name"),
    supabase.from("certifications").select("*").eq("user_id", userId).order("issue_date", { ascending: false, nullsFirst: false }),
    supabase.from("projects").select("*").eq("user_id", userId).order("start_date", { ascending: false, nullsFirst: false }),
    supabase.from("profile_extras").select("*").eq("user_id", userId).order("kind").order("date", { ascending: false, nullsFirst: false }),
  ]);

  if (!p.data || !candidate.data) {
    throw new Error("Profile not found");
  }

  return {
    profile: p.data as Profile,
    candidate: candidate.data,
    experiences: experiences.data ?? [],
    education: education.data ?? [],
    skills: skills.data ?? [],
    certifications: certifications.data ?? [],
    projects: projects.data ?? [],
    extras: extras.data ?? [],
  };
}

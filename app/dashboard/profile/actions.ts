"use server";

import { revalidatePath } from "next/cache";
import { check, checkRow, fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { requireActiveUserForAction } from "@/lib/auth/session";
import { uuid } from "@/lib/validation/common";
import {
  careerSchema,
  certificationSchema,
  educationSchema,
  experienceSchema,
  extraSchema,
  personalSchema,
  projectSchema,
  skillsAddSchema,
  skillUpdateSchema,
} from "@/lib/validation/profile";

function refresh() {
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
}

export async function updatePersonalAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = personalSchema.parse(input);
    check(await supabase.from("profiles").update({ full_name: v.fullName }).eq("id", userId));
    check(
      await supabase
        .from("candidate_profiles")
        .update({
          professional_title: v.professionalTitle,
          contact_email: v.contactEmail,
          phone: v.phone,
          location: v.location,
          country: v.country,
          linkedin_url: v.linkedinUrl,
          portfolio_url: v.portfolioUrl,
          github_url: v.githubUrl,
          website_url: v.websiteUrl,
        })
        .eq("user_id", userId),
    );
    refresh();
    return ok(null, "Personal details saved.");
  });
}

export async function updateCareerAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = careerSchema.parse(input);
    check(
      await supabase
        .from("candidate_profiles")
        .update({
          professional_summary: v.professionalSummary,
          years_experience: v.yearsExperience,
          current_occupation: v.currentOccupation,
          preferred_job_titles: v.preferredJobTitles,
          preferred_industries: v.preferredIndustries,
          preferred_employment_types: v.preferredEmploymentTypes,
          preferred_locations: v.preferredLocations,
          work_arrangements: v.workArrangements,
          salary_expectation: v.salaryExpectation,
        })
        .eq("user_id", userId),
    );
    refresh();
    return ok(null, "Career information saved.");
  });
}

/* Work experience ---------------------------------------------------------- */
export async function saveExperienceAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = experienceSchema.parse(input);
    const row = {
      company: v.company,
      job_title: v.jobTitle,
      employment_type: v.employmentType ?? null,
      location: v.location,
      start_date: v.startDate,
      end_date: v.endDate,
      is_current: v.isCurrent,
      responsibilities: v.responsibilities,
      achievements: v.achievements,
      technologies: v.technologies,
    };
    if (id) {
      const data = check(
        await supabase.from("work_experiences").update(row).eq("id", uuid.parse(id)).eq("user_id", userId).select("id").maybeSingle(),
      );
      if (!data) return fail("We couldn't find that role. Refresh and try again.");
      refresh();
      return ok({ id: data.id }, "Role updated.");
    }
    const data = checkRow(await supabase.from("work_experiences").insert({ ...row, user_id: userId }).select("id").single());
    refresh();
    return ok({ id: data.id }, "Role added.");
  });
}

export async function deleteExperienceAction(id: string): Promise<ActionResult<null>> {
  return deleteOwned("work_experiences", id, "Role removed.");
}

/* Education ---------------------------------------------------------------- */
export async function saveEducationAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = educationSchema.parse(input);
    const row = {
      institution: v.institution,
      qualification: v.qualification,
      field_of_study: v.fieldOfStudy,
      start_date: v.startDate,
      graduation_date: v.graduationDate,
      achievements: v.achievements,
    };
    if (id) {
      const data = check(await supabase.from("education").update(row).eq("id", uuid.parse(id)).eq("user_id", userId).select("id").maybeSingle());
      if (!data) return fail("We couldn't find that entry. Refresh and try again.");
      refresh();
      return ok({ id: data.id }, "Education updated.");
    }
    const data = checkRow(await supabase.from("education").insert({ ...row, user_id: userId }).select("id").single());
    refresh();
    return ok({ id: data.id }, "Education added.");
  });
}

export async function deleteEducationAction(id: string): Promise<ActionResult<null>> {
  return deleteOwned("education", id, "Education removed.");
}

/* Skills ------------------------------------------------------------------- */
export async function addSkillsAction(input: unknown): Promise<ActionResult<{ added: number }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = skillsAddSchema.parse(input);
    const { data: existing } = await supabase.from("skills").select("skill_name").eq("user_id", userId);
    const have = new Set((existing ?? []).map((s) => s.skill_name.toLowerCase()));
    const rows = v.names
      .filter((n) => !have.has(n.toLowerCase()))
      .map((n) => ({ user_id: userId, skill_name: n, skill_category: v.category, proficiency: v.proficiency ?? null }));
    if ((existing?.length ?? 0) + rows.length > 300) return fail("You can store up to 300 skills.");
    if (rows.length > 0) check(await supabase.from("skills").insert(rows));
    refresh();
    return ok({ added: rows.length }, rows.length ? `${rows.length} skill${rows.length === 1 ? "" : "s"} added.` : "Those skills are already on your profile.");
  });
}

export async function updateSkillAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = skillUpdateSchema.parse(input);
    const data = check(
      await supabase
        .from("skills")
        .update({ skill_name: v.name, skill_category: v.category, proficiency: v.proficiency ?? null })
        .eq("id", uuid.parse(id))
        .eq("user_id", userId)
        .select("id")
        .maybeSingle(),
    );
    if (!data) return fail("We couldn't find that skill.");
    refresh();
    return ok(null, "Skill updated.");
  });
}

export async function deleteSkillAction(id: string): Promise<ActionResult<null>> {
  return deleteOwned("skills", id, "Skill removed.");
}

/* Certifications ----------------------------------------------------------- */
export async function saveCertificationAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = certificationSchema.parse(input);
    const row = {
      name: v.name,
      institution: v.institution,
      issue_date: v.issueDate,
      expiry_date: v.expiryDate,
      credential_id: v.credentialId,
      credential_url: v.credentialUrl,
    };
    if (id) {
      const data = check(await supabase.from("certifications").update(row).eq("id", uuid.parse(id)).eq("user_id", userId).select("id").maybeSingle());
      if (!data) return fail("We couldn't find that certification.");
      refresh();
      return ok({ id: data.id }, "Certification updated.");
    }
    const data = checkRow(await supabase.from("certifications").insert({ ...row, user_id: userId }).select("id").single());
    refresh();
    return ok({ id: data.id }, "Certification added.");
  });
}

export async function deleteCertificationAction(id: string): Promise<ActionResult<null>> {
  return deleteOwned("certifications", id, "Certification removed.");
}

/* Projects ----------------------------------------------------------------- */
export async function saveProjectAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = projectSchema.parse(input);
    const row = {
      title: v.title,
      role: v.role,
      description: v.description,
      technologies: v.technologies,
      project_url: v.projectUrl,
      start_date: v.startDate,
      end_date: v.endDate,
    };
    if (id) {
      const data = check(await supabase.from("projects").update(row).eq("id", uuid.parse(id)).eq("user_id", userId).select("id").maybeSingle());
      if (!data) return fail("We couldn't find that project.");
      refresh();
      return ok({ id: data.id }, "Project updated.");
    }
    const data = checkRow(await supabase.from("projects").insert({ ...row, user_id: userId }).select("id").single());
    refresh();
    return ok({ id: data.id }, "Project added.");
  });
}

export async function deleteProjectAction(id: string): Promise<ActionResult<null>> {
  return deleteOwned("projects", id, "Project removed.");
}

/* Additional information --------------------------------------------------- */
export async function saveExtraAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = extraSchema.parse(input);
    const row = { kind: v.kind, title: v.title, organisation: v.organisation, date: v.date, description: v.description, url: v.url };
    if (id) {
      const data = check(await supabase.from("profile_extras").update(row).eq("id", uuid.parse(id)).eq("user_id", userId).select("id").maybeSingle());
      if (!data) return fail("We couldn't find that entry.");
      refresh();
      return ok({ id: data.id }, "Saved.");
    }
    const data = checkRow(await supabase.from("profile_extras").insert({ ...row, user_id: userId }).select("id").single());
    refresh();
    return ok({ id: data.id }, "Added.");
  });
}

export async function deleteExtraAction(id: string): Promise<ActionResult<null>> {
  return deleteOwned("profile_extras", id, "Removed.");
}

/* Shared ------------------------------------------------------------------- */
type OwnedTable = "work_experiences" | "education" | "skills" | "certifications" | "projects" | "profile_extras";

async function deleteOwned(table: OwnedTable, id: string, message: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const data = check(await supabase.from(table).delete().eq("id", uuid.parse(id)).eq("user_id", userId).select("id"));
    if (!data || data.length === 0) return fail("We couldn't find that item. It may already have been removed.");
    refresh();
    return ok(null, message);
  });
}

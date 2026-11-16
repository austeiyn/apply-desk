"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, checkRow, fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { requireActiveUserForAction } from "@/lib/auth/session";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { jobDetailsSchema, trackingSchema } from "@/lib/validation/application";
import { longText, optionalText, uuid } from "@/lib/validation/common";
import { INTERVIEW_TYPE_VALUES } from "@/lib/constants";

function refresh(id?: string) {
  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/dashboard/applications/${id}`);
}

export async function createApplicationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = jobDetailsSchema.parse(input);
    const row = checkRow(
      await supabase
        .from("job_applications")
        .insert({
          user_id: userId,
          job_title: v.jobTitle,
          company_name: v.companyName,
          job_url: v.jobUrl,
          source: v.jobUrl && v.source === "url" ? "url" : "manual",
          location: v.location,
          employment_type: v.employmentType,
          salary_range: v.salaryRange,
          deadline: v.deadline,
          job_description: v.jobDescription,
          responsibilities: v.responsibilities,
          required_qualifications: v.requiredQualifications,
          required_skills: v.requiredSkills,
          preferred_qualifications: v.preferredQualifications,
        })
        .select("id")
        .single(),
    );
    refresh();
    return ok({ id: row.id }, "Application saved.");
  });
}

export async function updateJobDetailsAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const appId = uuid.parse(id);
    const v = jobDetailsSchema.parse(input);
    const data = check(
      await supabase
        .from("job_applications")
        .update({
          job_title: v.jobTitle,
          company_name: v.companyName,
          job_url: v.jobUrl,
          location: v.location,
          employment_type: v.employmentType,
          salary_range: v.salaryRange,
          deadline: v.deadline,
          job_description: v.jobDescription,
          responsibilities: v.responsibilities,
          required_qualifications: v.requiredQualifications,
          required_skills: v.requiredSkills,
          preferred_qualifications: v.preferredQualifications,
        })
        .eq("id", appId)
        .eq("user_id", userId)
        .select("id"),
    );
    if (!data?.length) return fail("Application not found.");
    refresh(appId);
    return ok(null, "Job details saved.");
  });
}

export async function updateTrackingAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const appId = uuid.parse(id);
    const v = trackingSchema.parse(input);
    const data = check(
      await supabase
        .from("job_applications")
        .update({
          application_status: v.applicationStatus,
          application_date: v.applicationDate,
          deadline: v.deadline,
          recruiter_name: v.recruiterName,
          recruiter_email: v.recruiterEmail,
          recruiter_phone: v.recruiterPhone,
          next_action: v.nextAction,
          next_action_date: v.nextActionDate,
          follow_up_date: v.followUpDate,
          offered_salary: v.offeredSalary,
          final_outcome: v.finalOutcome,
          notes: v.notes,
        })
        .eq("id", appId)
        .eq("user_id", userId)
        .select("id"),
    );
    if (!data?.length) return fail("Application not found.");
    refresh(appId);
    return ok(null, "Tracking details saved.");
  });
}

/** Explicit, user-initiated status change (Kanban drag, status menu). */
export async function updateStatusAction(id: string, status: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const appId = uuid.parse(id);
    const next = z.enum(APPLICATION_STATUSES).parse(status);
    const { data: current } = await supabase.from("job_applications").select("application_status, application_date").eq("id", appId).eq("user_id", userId).maybeSingle();
    if (!current) return fail("Application not found.");
    const update: { application_status: string; application_date?: string } = { application_status: next };
    // When the user marks it as applied, record today's date if none was set.
    if (next === "applied" && !current.application_date) update.application_date = new Date().toISOString().slice(0, 10);
    check(await supabase.from("job_applications").update(update).eq("id", appId).eq("user_id", userId));
    refresh(appId);
    return ok(null);
  });
}

export async function deleteApplicationAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const appId = uuid.parse(id);
    const data = check(await supabase.from("job_applications").delete().eq("id", appId).eq("user_id", userId).select("id"));
    if (!data?.length) return fail("Application not found.");
    refresh();
    revalidatePath("/dashboard/resumes");
    revalidatePath("/dashboard/cover-letters");
    return ok(null, "Application deleted. Its resumes and cover letters remain in your library.");
  });
}

export async function addNoteEventAction(id: string, note: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const appId = uuid.parse(id);
    const text = z.string().trim().min(1, "Write a note first.").max(1000).parse(note);
    check(await supabase.from("application_events").insert({ user_id: userId, application_id: appId, event_type: "note", description: text }));
    refresh(appId);
    return ok(null, "Added to the timeline.");
  });
}

/* Interviews --------------------------------------------------------------- */

const interviewSchema = z.object({
  scheduledAt: z
    .string()
    .min(1, "Choose a date and time.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Choose a valid date and time."),
  durationMinutes: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 1440), "Enter minutes between 1 and 1440."),
  interviewType: z.enum(INTERVIEW_TYPE_VALUES),
  location: optionalText(500),
  interviewers: optionalText(500),
  notes: longText(20000),
  outcome: z.enum(["pending", "progressed", "not_progressed", "cancelled"]).default("pending"),
});
export type InterviewInput = z.input<typeof interviewSchema>;

export async function saveInterviewAction(applicationId: string, interviewId: string | null, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const appId = uuid.parse(applicationId);
    const v = interviewSchema.parse(input);
    const row = {
      scheduled_at: new Date(v.scheduledAt).toISOString(),
      duration_minutes: v.durationMinutes,
      interview_type: v.interviewType,
      location: v.location,
      interviewers: v.interviewers,
      notes: v.notes,
      outcome: v.outcome,
    };
    if (interviewId) {
      const data = check(await supabase.from("interviews").update(row).eq("id", uuid.parse(interviewId)).eq("user_id", userId).select("id"));
      if (!data?.length) return fail("Interview not found.");
    } else {
      check(await supabase.from("interviews").insert({ ...row, user_id: userId, application_id: appId }));
      await supabase.from("application_events").insert({
        user_id: userId,
        application_id: appId,
        event_type: "interview_added",
        description: `Interview scheduled for ${new Date(v.scheduledAt).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}`,
      });
    }
    refresh(appId);
    return ok(null, interviewId ? "Interview updated." : "Interview added.");
  });
}

export async function deleteInterviewAction(applicationId: string, interviewId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    check(await supabase.from("interviews").delete().eq("id", uuid.parse(interviewId)).eq("user_id", userId));
    refresh(uuid.parse(applicationId));
    return ok(null, "Interview removed.");
  });
}

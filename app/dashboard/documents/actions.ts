"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, checkRow, fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { requireActiveUserForAction } from "@/lib/auth/session";
import { COVER_LETTER_TONE_VALUES } from "@/lib/constants";
import { getOwnedApplication } from "@/lib/data/applications";
import { getCandidateBundle } from "@/lib/data/profile";
import { resumeFromProfile } from "@/lib/resume/assemble";
import { ResumeContentSchema } from "@/lib/resume/types";
import { uuid } from "@/lib/validation/common";

const title = z.string().trim().min(1, "Enter a title.").max(200);

function refreshDocs(kind: "resume" | "cover", id?: string, applicationId?: string | null) {
  revalidatePath(kind === "resume" ? "/dashboard/resumes" : "/dashboard/cover-letters");
  if (id) revalidatePath(kind === "resume" ? `/dashboard/resumes/${id}` : `/dashboard/cover-letters/${id}`);
  if (applicationId) revalidatePath(`/dashboard/applications/${applicationId}`);
  revalidatePath("/dashboard");
}

/* Resumes ------------------------------------------------------------------- */

export async function createResumeFromProfileAction(applicationId: string | null): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId, profile } = await requireActiveUserForAction();
    const app = applicationId ? await getOwnedApplication(supabase, userId, uuid.parse(applicationId)) : null;
    if (applicationId && !app) return fail("Application not found.");
    const bundle = await getCandidateBundle(supabase, userId, profile);
    const content = resumeFromProfile(bundle, app ? { id: app.id, job_title: app.job_title, company_name: app.company_name } : null);
    const row = checkRow(
      await supabase
        .from("generated_resumes")
        .insert({
          user_id: userId,
          application_id: app?.id ?? null,
          title: (app ? ["Resume", app.job_title, app.company_name].filter(Boolean).join(" – ") : `${profile.full_name || "My"} resume`).slice(0, 200),
          content_json: content as never,
          origin: "manual",
          last_change_summary: "Created from profile",
        })
        .select("id")
        .single(),
    );
    refreshDocs("resume", row.id, app?.id);
    return ok({ id: row.id }, "Resume created from your profile.");
  });
}

const saveResumeSchema = z.object({
  title,
  content: ResumeContentSchema,
  changeSummary: z.string().trim().max(300).optional(),
});

export async function saveResumeAction(id: string, input: unknown): Promise<ActionResult<{ version: number; updatedAt: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = saveResumeSchema.parse(input);
    const row = checkRow(
      await supabase
        .from("generated_resumes")
        .update({ title: v.title, content_json: v.content as never, last_change_summary: v.changeSummary || "Edited" })
        .eq("id", uuid.parse(id))
        .eq("user_id", userId)
        .select("version, updated_at, application_id")
        .maybeSingle(),
    );
    refreshDocs("resume", id, row.application_id);
    return ok({ version: row.version, updatedAt: row.updated_at }, "Resume saved.");
  });
}

export async function restoreResumeVersionAction(id: string, version: number): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const resumeId = uuid.parse(id);
    const v = z.number().int().min(1).parse(version);
    const snapshot = checkRow(
      await supabase.from("resume_versions").select("content_json").eq("resume_id", resumeId).eq("user_id", userId).eq("version", v).maybeSingle(),
    );
    const row = checkRow(
      await supabase
        .from("generated_resumes")
        .update({ content_json: snapshot.content_json, last_change_summary: `Restored version ${v}` })
        .eq("id", resumeId)
        .eq("user_id", userId)
        .select("version, application_id")
        .maybeSingle(),
    );
    refreshDocs("resume", resumeId, row.application_id);
    return ok({ version: row.version }, `Version ${v} restored as version ${row.version}.`);
  });
}

export async function duplicateResumeAction(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const src = checkRow(
      await supabase.from("generated_resumes").select("title, content_json, application_id").eq("id", uuid.parse(id)).eq("user_id", userId).maybeSingle(),
    );
    const row = checkRow(
      await supabase
        .from("generated_resumes")
        .insert({
          user_id: userId,
          application_id: src.application_id,
          title: `${src.title} (copy)`.slice(0, 200),
          content_json: src.content_json,
          origin: "duplicate",
          last_change_summary: "Duplicated",
        })
        .select("id")
        .single(),
    );
    refreshDocs("resume", row.id, src.application_id);
    return ok({ id: row.id }, "Resume duplicated.");
  });
}

export async function deleteResumeAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const data = check(await supabase.from("generated_resumes").delete().eq("id", uuid.parse(id)).eq("user_id", userId).select("application_id"));
    if (!data?.length) return fail("Resume not found.");
    refreshDocs("resume", undefined, data[0]?.application_id);
    return ok(null, "Resume deleted.");
  });
}

/* Cover letters --------------------------------------------------------------- */

export async function createBlankCoverLetterAction(applicationId: string | null): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId, profile } = await requireActiveUserForAction();
    const app = applicationId ? await getOwnedApplication(supabase, userId, uuid.parse(applicationId)) : null;
    if (applicationId && !app) return fail("Application not found.");
    const content = `Dear Hiring Manager,\n\n\n\nKind regards,\n${profile.full_name}`;
    const row = checkRow(
      await supabase
        .from("generated_cover_letters")
        .insert({
          user_id: userId,
          application_id: app?.id ?? null,
          title: (app ? ["Cover letter", app.job_title, app.company_name].filter(Boolean).join(" – ") : "Cover letter").slice(0, 200),
          content,
          tone: "professional",
          origin: "manual",
        })
        .select("id")
        .single(),
    );
    refreshDocs("cover", row.id, app?.id);
    return ok({ id: row.id });
  });
}

const saveLetterSchema = z.object({
  title,
  content: z.string().max(20000, "Cover letters are limited to 20,000 characters."),
  tone: z.enum(COVER_LETTER_TONE_VALUES),
});

export async function saveCoverLetterAction(id: string, input: unknown): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = saveLetterSchema.parse(input);
    const row = checkRow(
      await supabase
        .from("generated_cover_letters")
        .update({ title: v.title, content: v.content, tone: v.tone })
        .eq("id", uuid.parse(id))
        .eq("user_id", userId)
        .select("version, application_id")
        .maybeSingle(),
    );
    refreshDocs("cover", id, row.application_id);
    return ok({ version: row.version }, "Cover letter saved.");
  });
}

export async function duplicateCoverLetterAction(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const src = checkRow(
      await supabase.from("generated_cover_letters").select("title, content, tone, application_id").eq("id", uuid.parse(id)).eq("user_id", userId).maybeSingle(),
    );
    const row = checkRow(
      await supabase
        .from("generated_cover_letters")
        .insert({ user_id: userId, application_id: src.application_id, title: `${src.title} (copy)`.slice(0, 200), content: src.content, tone: src.tone, origin: "duplicate" })
        .select("id")
        .single(),
    );
    refreshDocs("cover", row.id, src.application_id);
    return ok({ id: row.id }, "Cover letter duplicated.");
  });
}

export async function deleteCoverLetterAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const data = check(await supabase.from("generated_cover_letters").delete().eq("id", uuid.parse(id)).eq("user_id", userId).select("application_id"));
    if (!data?.length) return fail("Cover letter not found.");
    refreshDocs("cover", undefined, data[0]?.application_id);
    return ok(null, "Cover letter deleted.");
  });
}

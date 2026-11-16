"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, checkRow, fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { requireActiveUserForAction } from "@/lib/auth/session";
import { CV_MAX_BYTES } from "@/lib/constants";
import { CvExtractionSchema } from "@/lib/ai/cv-extractor";
import { CvFileError, extractCvText } from "@/lib/cv/extract-text";
import { getPlatformSettings } from "@/lib/settings";
import { fromMonthInput } from "@/lib/utils";
import type { Update } from "@/lib/db/types";
import { optionalText, uuid } from "@/lib/validation/common";

const BUCKET = "source-cvs";

const registerSchema = z.object({
  storagePath: z.string().max(200),
  fileName: z.string().trim().min(1).max(255),
  label: optionalText(120),
});

function refresh() {
  revalidatePath("/dashboard/cv");
  revalidatePath("/dashboard");
}

/**
 * Called after the browser uploads a file straight to private storage.
 * Re-validates everything server-side: path ownership, real file type (magic
 * bytes), size, and that text can be extracted. Invalid files are deleted.
 */
export async function registerCvUploadAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = registerSchema.parse(input);

    const pathPattern = new RegExp(`^${userId}/[0-9a-f-]{36}\\.(pdf|docx)$`);
    if (!pathPattern.test(v.storagePath)) return fail("Invalid upload path.");

    const settings = await getPlatformSettings();
    const { count } = await supabase.from("source_cvs").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if ((count ?? 0) >= settings.max_source_cvs) {
      await supabase.storage.from(BUCKET).remove([v.storagePath]);
      return fail(`You can keep up to ${settings.max_source_cvs} CV files. Delete an older version first.`);
    }

    const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(v.storagePath);
    if (dlError || !blob) return fail("We couldn't find the uploaded file. Please try uploading again.");
    if (blob.size > CV_MAX_BYTES) {
      await supabase.storage.from(BUCKET).remove([v.storagePath]);
      return fail("The file is larger than 10 MB.");
    }

    let extracted: Awaited<ReturnType<typeof extractCvText>>;
    try {
      extracted = await extractCvText(new Uint8Array(await blob.arrayBuffer()));
    } catch (error) {
      await supabase.storage.from(BUCKET).remove([v.storagePath]);
      if (error instanceof CvFileError) return fail(error.message);
      throw error;
    }

    const { data: latest } = await supabase
      .from("source_cvs")
      .select("version")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = checkRow(
      await supabase
        .from("source_cvs")
        .insert({
          user_id: userId,
          file_name: v.fileName.replace(/[\\/]/g, "_"),
          storage_path: v.storagePath,
          mime_type: extracted.mimeType,
          file_size: blob.size,
          label: v.label,
          extracted_text: extracted.text,
          extraction_status: "extracted",
          version: (latest?.version ?? 0) + 1,
          is_primary: (count ?? 0) === 0,
        })
        .select("id")
        .single(),
    );
    refresh();
    return ok({ id: row.id }, "CV uploaded and text extracted.");
  });
}

export async function setPrimaryCvAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const cvId = uuid.parse(id);
    const { data: target } = await supabase.from("source_cvs").select("id").eq("id", cvId).eq("user_id", userId).maybeSingle();
    if (!target) return fail("CV not found.");
    check(await supabase.from("source_cvs").update({ is_primary: false }).eq("user_id", userId).eq("is_primary", true));
    check(await supabase.from("source_cvs").update({ is_primary: true }).eq("id", cvId).eq("user_id", userId));
    refresh();
    return ok(null, "Primary CV updated.");
  });
}

export async function updateCvLabelAction(id: string, label: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const parsed = optionalText(120).parse(label);
    check(await supabase.from("source_cvs").update({ label: parsed }).eq("id", uuid.parse(id)).eq("user_id", userId));
    refresh();
    return ok(null, "Label saved.");
  });
}

export async function deleteCvAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const { data: cv } = await supabase
      .from("source_cvs")
      .select("id, storage_path, is_primary")
      .eq("id", uuid.parse(id))
      .eq("user_id", userId)
      .maybeSingle();
    if (!cv) return fail("CV not found.");
    await supabase.storage.from(BUCKET).remove([cv.storage_path]);
    check(await supabase.from("source_cvs").delete().eq("id", cv.id).eq("user_id", userId));
    if (cv.is_primary) {
      const { data: next } = await supabase
        .from("source_cvs")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (next) await supabase.from("source_cvs").update({ is_primary: true }).eq("id", next.id).eq("user_id", userId);
    }
    refresh();
    return ok(null, "CV deleted.");
  });
}

/** Short-lived signed URL; RLS on storage ensures users can only sign their own files. */
export async function getCvDownloadUrlAction(id: string): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const { data: cv } = await supabase
      .from("source_cvs")
      .select("storage_path, file_name")
      .eq("id", uuid.parse(id))
      .eq("user_id", userId)
      .maybeSingle();
    if (!cv) return fail("CV not found.");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(cv.storage_path, 60, { download: cv.file_name });
    if (error || !data) return fail("We couldn't prepare the download. Please try again.");
    return ok({ url: data.signedUrl });
  });
}

/* Applying reviewed extraction ------------------------------------------- */

const PERSONAL_KEYS = [
  "full_name",
  "professional_title",
  "email",
  "phone",
  "city",
  "country",
  "linkedin_url",
  "portfolio_url",
  "github_url",
  "website_url",
] as const;

const indexList = z.array(z.number().int().min(0).max(500)).max(500).default([]);

const applySchema = z.object({
  personal: z.array(z.enum(PERSONAL_KEYS)).default([]),
  summary: z.boolean().default(false),
  experiences: indexList,
  education: indexList,
  skills: indexList,
  certifications: indexList,
  projects: indexList,
  extras: indexList,
});
export type ApplyCvSelection = z.input<typeof applySchema>;

/** "2021-03" | "2021" -> DATE string */
function cvDate(v: string | null): string | null {
  if (!v) return null;
  if (/^\d{4}$/.test(v)) return `${v}-01-01`;
  return fromMonthInput(v);
}

const safeUrl = (v: string | null): string | null => {
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return ["http:", "https:"].includes(u.protocol) ? u.toString().slice(0, 2048) : null;
  } catch {
    return null;
  }
};

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Apply only the items the user explicitly selected. The extracted data is
 * read from the database (never trusted from the client). Personal fields
 * are only overwritten when the user ticked them; list items are added as new
 * entries, skipping duplicates.
 */
export async function applyParsedCvAction(cvId: string, input: unknown): Promise<ActionResult<{ added: number }>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const sel = applySchema.parse(input);
    const { data: cv } = await supabase.from("source_cvs").select("id, parsed_data").eq("id", uuid.parse(cvId)).eq("user_id", userId).maybeSingle();
    if (!cv?.parsed_data) return fail("There's no extracted data to apply for this CV.");
    const parsed = CvExtractionSchema.safeParse(cv.parsed_data);
    if (!parsed.success) return fail("The extracted data is no longer valid. Run extraction again.");
    const x = parsed.data;
    let added = 0;

    // Personal & summary fields.
    const p = x.personal;
    const profileUpdate: Update<"profiles"> = {};
    const candidateUpdate: Update<"candidate_profiles"> = {};
    for (const key of sel.personal) {
      const value = p[key];
      if (!value) continue;
      switch (key) {
        case "full_name":
          profileUpdate.full_name = value.slice(0, 200);
          break;
        case "email":
          if (z.email().safeParse(value).success) candidateUpdate.contact_email = value.toLowerCase();
          break;
        case "city":
          candidateUpdate.location = value.slice(0, 200);
          break;
        case "linkedin_url":
        case "portfolio_url":
        case "github_url":
        case "website_url":
          candidateUpdate[key] = safeUrl(value);
          break;
        case "phone":
          candidateUpdate.phone = value.slice(0, 50);
          break;
        case "professional_title":
        case "country":
          candidateUpdate[key] = value.slice(0, key === "country" ? 100 : 200);
          break;
      }
    }
    if (sel.summary && x.professional_summary) candidateUpdate.professional_summary = x.professional_summary.slice(0, 5000);
    if (Object.keys(profileUpdate).length) check(await supabase.from("profiles").update(profileUpdate).eq("id", userId));
    if (Object.keys(candidateUpdate).length) check(await supabase.from("candidate_profiles").update(candidateUpdate).eq("user_id", userId));

    // Existing data for de-duplication.
    const [exp, edu, skills, certs, projects, extras] = await Promise.all([
      supabase.from("work_experiences").select("company, job_title, start_date").eq("user_id", userId),
      supabase.from("education").select("institution, qualification").eq("user_id", userId),
      supabase.from("skills").select("skill_name").eq("user_id", userId),
      supabase.from("certifications").select("name").eq("user_id", userId),
      supabase.from("projects").select("title").eq("user_id", userId),
      supabase.from("profile_extras").select("kind, title").eq("user_id", userId),
    ]);

    const pick = <T,>(list: T[], idx: number[]) => [...new Set(idx)].map((i) => list[i]).filter((v): v is T => v !== undefined);

    const expKeys = new Set((exp.data ?? []).map((e) => `${norm(e.company)}|${norm(e.job_title)}|${e.start_date?.slice(0, 7) ?? ""}`));
    const expRows = pick(x.work_experiences, sel.experiences)
      .map((e) => ({
        user_id: userId,
        company: e.company.slice(0, 200),
        job_title: e.job_title.slice(0, 200),
        employment_type: e.employment_type,
        location: e.location?.slice(0, 200) ?? null,
        start_date: cvDate(e.start_date),
        end_date: e.is_current ? null : cvDate(e.end_date),
        is_current: e.is_current,
        responsibilities: e.responsibilities.join("\n").slice(0, 10000),
        achievements: e.achievements.join("\n").slice(0, 10000),
        technologies: e.technologies.slice(0, 100),
      }))
      .filter((r) => {
        if (r.start_date && r.end_date && r.end_date < r.start_date) r.end_date = null;
        const key = `${norm(r.company)}|${norm(r.job_title)}|${r.start_date?.slice(0, 7) ?? ""}`;
        if (expKeys.has(key)) return false;
        expKeys.add(key);
        return true;
      });
    if (expRows.length) check(await supabase.from("work_experiences").insert(expRows));

    const eduKeys = new Set((edu.data ?? []).map((e) => `${norm(e.institution)}|${norm(e.qualification)}`));
    const eduRows = pick(x.education, sel.education)
      .map((e) => ({
        user_id: userId,
        institution: e.institution.slice(0, 200),
        qualification: e.qualification.slice(0, 200),
        field_of_study: e.field_of_study?.slice(0, 200) ?? null,
        start_date: cvDate(e.start_date),
        graduation_date: cvDate(e.graduation_date),
        achievements: e.achievements.join("\n").slice(0, 5000),
      }))
      .filter((r) => {
        const key = `${norm(r.institution)}|${norm(r.qualification)}`;
        if (eduKeys.has(key)) return false;
        eduKeys.add(key);
        return true;
      });
    if (eduRows.length) check(await supabase.from("education").insert(eduRows));

    const skillKeys = new Set((skills.data ?? []).map((s) => s.skill_name.toLowerCase()));
    const skillRows = pick(x.skills, sel.skills)
      .filter((s) => {
        const k = s.name.toLowerCase();
        if (!k || skillKeys.has(k)) return false;
        skillKeys.add(k);
        return true;
      })
      .map((s) => ({ user_id: userId, skill_name: s.name.slice(0, 100), skill_category: s.category }));
    if (skillRows.length) check(await supabase.from("skills").insert(skillRows));

    const certKeys = new Set((certs.data ?? []).map((c) => norm(c.name)));
    const certRows = pick(x.certifications, sel.certifications)
      .filter((c) => !certKeys.has(norm(c.name)) && certKeys.add(norm(c.name)))
      .map((c) => ({
        user_id: userId,
        name: c.name.slice(0, 200),
        institution: c.institution?.slice(0, 200) ?? null,
        issue_date: cvDate(c.issue_date),
        expiry_date: cvDate(c.expiry_date),
      }))
      .map((c) => (c.issue_date && c.expiry_date && c.expiry_date < c.issue_date ? { ...c, expiry_date: null } : c));
    if (certRows.length) check(await supabase.from("certifications").insert(certRows));

    const projKeys = new Set((projects.data ?? []).map((p) => norm(p.title)));
    const projRows = pick(x.projects, sel.projects)
      .filter((p) => !projKeys.has(norm(p.title)) && projKeys.add(norm(p.title)))
      .map((p) => ({
        user_id: userId,
        title: p.title.slice(0, 200),
        description: p.description.slice(0, 5000),
        technologies: p.technologies.slice(0, 100),
        project_url: safeUrl(p.url),
      }));
    if (projRows.length) check(await supabase.from("projects").insert(projRows));

    const extraKeys = new Set((extras.data ?? []).map((e) => `${e.kind}|${norm(e.title)}`));
    const extraRows = pick(x.extras, sel.extras)
      .filter((e) => !extraKeys.has(`${e.kind}|${norm(e.title)}`) && extraKeys.add(`${e.kind}|${norm(e.title)}`))
      .map((e) => ({
        user_id: userId,
        kind: e.kind,
        title: e.title.slice(0, 300),
        organisation: e.organisation?.slice(0, 200) ?? null,
        date: cvDate(e.date),
        description: e.description.slice(0, 5000),
      }));
    if (extraRows.length) check(await supabase.from("profile_extras").insert(extraRows));

    added = expRows.length + eduRows.length + skillRows.length + certRows.length + projRows.length + extraRows.length;
    check(
      await supabase
        .from("source_cvs")
        .update({ extraction_status: "applied", applied_at: new Date().toISOString() })
        .eq("id", cv.id)
        .eq("user_id", userId),
    );
    revalidatePath("/dashboard/profile");
    refresh();
    return ok({ added }, `Profile updated. ${added} item${added === 1 ? "" : "s"} added.`);
  });
}

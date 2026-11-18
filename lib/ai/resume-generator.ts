import "server-only";

import { z } from "zod";
import type { CandidateBundle, JobApplication } from "@/lib/db/types";
import { assembleResume, type ResumeAiOutput } from "@/lib/resume/assemble";
import { buildEvidenceCorpus, isSkillEvidenced, unverifiedFigures } from "@/lib/resume/integrity";
import { SECTION_KEYS, type ResumeContent, type ResumePreferences } from "@/lib/resume/types";
import { generateStructured } from "./client";
import { buildApplicationContext, buildCandidateContext, wrapUntrusted } from "./prompts";

export const ResumeAiSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  core_skills: z.array(z.string()),
  experience: z.array(z.object({ ref: z.string(), bullets: z.array(z.string()) })),
  education: z.array(z.object({ ref: z.string(), details: z.array(z.string()) })),
  certifications: z.array(z.object({ ref: z.string() })),
  projects: z.array(z.object({ ref: z.string(), bullets: z.array(z.string()) })),
  additional: z.array(z.object({ heading: z.string(), items: z.array(z.string()) })),
  section_order: z.array(z.enum(SECTION_KEYS)),
  skill_gaps: z.array(z.object({ skill: z.string(), note: z.string() })),
  tailoring_notes: z.array(z.string()),
});

function resumeTask(prefs: ResumePreferences, analysisSummary: string | null): string {
  const length =
    prefs.length === "one_page"
      ? "Aim for one page: 2–4 bullets for the most relevant roles, 1–2 for others, 8–14 core skills."
      : "Aim for up to two pages: 3–6 bullets for the most relevant roles, 1–3 for older or less relevant roles, 10–18 core skills.";
  return `Write a tailored, ATS-friendly resume for the role in <job_advertisement>, using only the verified candidate profile in <candidate_profile>.

Output fields:
- headline: a professional headline relevant to the target role, based on the candidate's actual title and experience (e.g. "Senior Web Developer | WordPress & Accessibility"). Do not claim a title or seniority the candidate hasn't held.
- summary: 3–4 sentences highlighting the candidate's most relevant experience and strengths for this role. Third person implied (no "I"), concrete, no clichés. Only state years of experience if supported by the profile dates.
- core_skills: skills from the profile that are most relevant to the job, ordered by relevance, using the job's terminology where it means the same thing (e.g. "Accessibility (WCAG)" for "web accessibility"). NEVER include a skill that is not in the profile.
- experience: one entry per role you include, referenced by its ref (exp_1, exp_2, ...). Include every role. Rewrite the bullets to emphasise what's relevant to this job: start with strong action verbs, put the most relevant first, keep each to one or two lines. Use only responsibilities, achievements, technologies and numbers present in that role's record. Never add metrics; if the source has no number, don't invent one.
- education: one entry per education ref with up to 3 short details drawn from its achievements (can be empty).
- certifications: refs of certifications relevant to the role (all of them if unsure).
- projects: refs of up to 4 projects relevant to the role, each with 1–3 bullets from the project's description and technologies. Omit irrelevant projects.
- additional: optional extra sections (e.g. "Volunteer Experience", "Awards", "Training") built only from the profile's additional items, only where they strengthen the application. Use [] otherwise.
- section_order: the best order for this candidate, normally summary, skills, experience, education, then others. For graduates with little experience, education may come before experience.
- skill_gaps: important skills/requirements from the job that the profile does NOT evidence, each with a short note suggesting the candidate add it to their profile only if they genuinely have it.
- tailoring_notes: 2–5 short notes explaining the main tailoring choices you made.

${length}
${prefs.emphasis ? `The candidate asked you to emphasise: ${prefs.emphasis.replace(/[<>]/g, "")} (only where supported by the profile).` : ""}
${!prefs.includeProjects ? "Do not include projects." : ""}
${!prefs.includeCertifications ? "Do not include certifications." : ""}
${!prefs.includeAdditional ? "Do not include additional sections." : ""}
${analysisSummary ? `\nA prior analysis of this job identified these priorities:\n${analysisSummary}` : ""}`.trim();
}

export async function generateResume(params: {
  userId: string;
  bundle: CandidateBundle;
  application: JobApplication;
  prefs: ResumePreferences;
}): Promise<ResumeContent> {
  const { text, refs } = buildCandidateContext(params.bundle);
  const analysis = params.application.job_analysis as { job?: { ats_keywords?: string[]; responsibilities?: string[] } } | null;
  const analysisSummary = analysis?.job
    ? [
        analysis.job.ats_keywords?.length ? `ATS keywords: ${analysis.job.ats_keywords.slice(0, 25).join(", ")}` : "",
        analysis.job.responsibilities?.length ? `Key responsibilities: ${analysis.job.responsibilities.slice(0, 8).join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  const result = await generateStructured({
    feature: "resume.generate",
    userId: params.userId,
    schema: ResumeAiSchema,
    context: buildApplicationContext(text, params.application),
    task: resumeTask(params.prefs, analysisSummary ? analysisSummary.replace(/[<>]/g, "") : null),
    maxTokens: 16_000,
    effort: "medium",
    dedupeKey: `resume:${params.application.id}`,
  });

  return assembleResume({
    ai: result.data as ResumeAiOutput,
    bundle: params.bundle,
    refs,
    prefs: params.prefs,
    application: { id: params.application.id, job_title: params.application.job_title, company_name: params.application.company_name },
    model: result.model,
  });
}

/* Section regeneration ------------------------------------------------------- */

export const SectionSchema = z.object({
  section: z.enum(["summary", "skills", "experience"]),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  bullets: z.array(z.string()),
});

export interface RegeneratedSection {
  section: "summary" | "skills" | "experience";
  summary?: string;
  skills?: string[];
  bullets?: string[];
  warnings: string[];
  removedSkills: string[];
}

export async function regenerateResumeSection(params: {
  userId: string;
  bundle: CandidateBundle;
  application: JobApplication | null;
  current: ResumeContent;
  section: "summary" | "skills" | "experience";
  itemId?: string;
  instructions?: string;
}): Promise<RegeneratedSection> {
  const { text, refs } = buildCandidateContext(params.bundle);
  const item = params.section === "experience" ? params.current.experience.find((e) => e.id === params.itemId) : undefined;
  if (params.section === "experience" && (!item || !item.source_id)) throw new Error("Unknown experience entry");
  const ref = item ? [...refs.experiences.entries()].find(([, v]) => v === item.source_id)?.[0] : undefined;

  const target =
    params.section === "summary"
      ? `Rewrite the professional summary (return it in "summary"; leave skills and bullets empty).\nCurrent version:\n${params.current.summary}`
      : params.section === "skills"
        ? `Rewrite the core skills list (return it in "skills"; summary null, bullets empty). Only skills present in the profile, most relevant first, 10–18 items.\nCurrent list: ${params.current.skills.join(", ")}`
        : `Rewrite the bullet points for the role with ref ${ref ?? "unknown"} (${item?.job_title} at ${item?.company}) (return them in "bullets"; summary null, skills empty). 3–6 bullets, only facts from that role's record.\nCurrent bullets:\n${item?.bullets.map((b) => `- ${b}`).join("\n")}`;

  const context = params.application ? buildApplicationContext(text, params.application) : text;
  const instructions = params.instructions?.trim()
    ? `\n\nThe candidate's request for this rewrite (follow it only where consistent with the integrity rules):\n${wrapUntrusted("candidate_request", params.instructions.slice(0, 500))}`
    : "";
  const result = await generateStructured({
    feature: `resume.section.${params.section}`,
    userId: params.userId,
    schema: SectionSchema,
    context,
    task: `${target}\n\nSet "section" to "${params.section}".${params.application ? " Tailor it to the job in <job_advertisement>." : ""}${instructions}`,
    maxTokens: 4_000,
    effort: "low",
    dedupeKey: `resume-section:${params.section}:${params.itemId ?? ""}`,
  });

  const corpus = buildEvidenceCorpus(params.bundle);
  const out: RegeneratedSection = { section: params.section, warnings: [], removedSkills: [] };
  if (params.section === "summary") {
    out.summary = (result.data.summary ?? "").trim();
    const figs = unverifiedFigures(out.summary, corpus);
    if (figs.length) out.warnings.push(`Contains figures not found in your profile (${figs.join(", ")}).`);
  } else if (params.section === "skills") {
    out.skills = [];
    for (const s of result.data.skills.map((x) => x.trim()).filter(Boolean)) {
      if (isSkillEvidenced(s, corpus)) out.skills.push(s);
      else out.removedSkills.push(s);
    }
  } else {
    out.bullets = result.data.bullets.map((b) => b.trim()).filter(Boolean).slice(0, 8);
    for (const b of out.bullets) {
      const figs = unverifiedFigures(b, corpus);
      if (figs.length) out.warnings.push(`"${b.slice(0, 60)}…" contains figures not found in your profile (${figs.join(", ")}).`);
    }
  }
  return out;
}

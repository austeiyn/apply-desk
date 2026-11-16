import "server-only";

import { z } from "zod";
import { FOLLOW_UP_KINDS, type FollowUpKind } from "@/lib/constants";
import type { CandidateBundle, JobApplication } from "@/lib/db/types";
import { buildEvidenceCorpus, unverifiedFigures } from "@/lib/resume/integrity";
import { generateStructured } from "./client";
import { buildApplicationContext, buildCandidateContext, wrapUntrusted } from "./prompts";

/* Schemas ---------------------------------------------------------------- */

export const ApplicationEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
  attachments: z.array(z.string()),
});

export const ProfessionalSummarySchema = z.object({
  linkedin_headline: z.string(),
  linkedin_about: z.string(),
  cv_summary: z.string(),
  short_bio: z.string(),
});

export const ApplicationAnswersSchema = z.object({
  answers: z.array(z.object({ question: z.string(), answer: z.string(), needs_input: z.string().nullable() })),
});

export const SkillGapSchema = z.object({
  existing_strengths: z.array(z.object({ skill: z.string(), evidence: z.string() })),
  partial_matches: z.array(z.object({ skill: z.string(), gap: z.string() })),
  missing_skills: z.array(z.object({ skill: z.string(), importance: z.enum(["required", "preferred"]), why_it_matters: z.string() })),
  learning_plan: z.array(z.object({ area: z.string(), actions: z.array(z.string()), timeframe: z.string() })),
  profile_improvements: z.array(z.string()),
});

export const FollowUpEmailSchema = z.object({ subject: z.string(), body: z.string() });

export type ToolKind = "application_email" | "professional_summary" | "application_answers" | "skill_gap" | "follow_up_email";

interface ToolContext {
  userId: string;
  bundle: CandidateBundle;
  application: JobApplication;
}

function context(ctx: ToolContext) {
  const { text } = buildCandidateContext(ctx.bundle);
  return buildApplicationContext(text, ctx.application);
}

function figureWarnings(texts: string[], bundle: CandidateBundle): string[] {
  const figs = unverifiedFigures(texts.join(" "), buildEvidenceCorpus(bundle));
  return figs.length ? [`Contains figures not found in your profile (${figs.join(", ")}). Check before sending.`] : [];
}

/* Tools -------------------------------------------------------------------- */

export async function generateApplicationEmail(ctx: ToolContext, attachments: string[]) {
  const { data } = await generateStructured({
    feature: "toolkit.application_email",
    userId: ctx.userId,
    schema: ApplicationEmailSchema,
    context: context(ctx),
    task: `Write a short, professional email the candidate can send when submitting their application for the role in <job_advertisement>.
- subject: a clear subject line including the job title (and reference number if the advertisement gives one).
- body: greeting (named contact only if the advertisement names one), 2 short paragraphs connecting the candidate's most relevant genuine experience to the role, a line referencing the attached documents, a polite close and the candidate's name and phone/email from the profile. 120–200 words. No invented facts.
- attachments: a checklist of what to attach, based on these documents the candidate has prepared: ${attachments.length ? attachments.join(", ") : "resume and cover letter"}, plus anything the advertisement explicitly asks for (e.g. portfolio, references, transcripts).`,
    maxTokens: 3_000,
    effort: "low",
    dedupeKey: `email:${ctx.application.id}`,
  });
  return { data, warnings: figureWarnings([data.body], ctx.bundle) };
}

export async function generateProfessionalSummary(ctx: ToolContext) {
  const { data } = await generateStructured({
    feature: "toolkit.professional_summary",
    userId: ctx.userId,
    schema: ProfessionalSummarySchema,
    context: context(ctx),
    task: `Write professional summaries for the candidate, positioned towards the kind of role in <job_advertisement> but true to their whole profile:
- linkedin_headline: up to 220 characters, e.g. "Senior Web Developer | WordPress, Accessibility & Performance".
- linkedin_about: 3 short paragraphs in the first person (150–250 words) covering what they do, their strongest genuine evidence, and what they're looking for.
- cv_summary: 3–4 sentence CV/resume summary without "I".
- short_bio: one or two sentences suitable for an email signature or networking intro.
Use only verified facts. No invented metrics.`,
    maxTokens: 3_000,
    effort: "low",
    dedupeKey: `summary:${ctx.application.id}`,
  });
  return { data, warnings: figureWarnings([data.linkedin_about, data.cv_summary], ctx.bundle) };
}

export async function generateApplicationAnswers(ctx: ToolContext, questions: string[]) {
  const qs = questions.map((q) => q.trim()).filter(Boolean).slice(0, 10);
  const salary = ctx.bundle.candidate.salary_expectation;
  const { data } = await generateStructured({
    feature: "toolkit.application_answers",
    userId: ctx.userId,
    schema: ApplicationAnswersSchema,
    context: context(ctx),
    task: `Draft answers to these application form questions for the role in <job_advertisement>, using only the verified candidate profile:
${wrapUntrusted("candidate_request", qs.map((q, i) => `${i + 1}. ${q}`).join("\n"))}

For each question return the question, an answer (80–180 words unless the question is factual, first person, specific, honest), and needs_input: a short note when the candidate must supply or confirm something you can't know (e.g. availability/start date, notice period, salary, visa status, why they personally want this company beyond the advertisement). Never invent these facts; write the answer with a clear placeholder like "[your notice period]".
${salary ? `The candidate's stated salary expectation is: ${salary.replace(/[<>]/g, "")}. Use it only for salary questions.` : "The candidate has not provided a salary expectation; suggest they research the market rate and leave a placeholder."}`,
    maxTokens: 8_000,
    effort: "medium",
    dedupeKey: `answers:${ctx.application.id}`,
  });
  return { data, warnings: figureWarnings(data.answers.map((a) => a.answer), ctx.bundle) };
}

export async function generateSkillGap(ctx: ToolContext) {
  const { data } = await generateStructured({
    feature: "toolkit.skill_gap",
    userId: ctx.userId,
    schema: SkillGapSchema,
    context: context(ctx),
    task: `Produce a skill gap analysis comparing the role in <job_advertisement> with the verified candidate profile.
- existing_strengths: skills the profile clearly evidences that the job wants, with the evidence.
- partial_matches: skills with related or partial evidence, and what's missing.
- missing_skills: skills/qualifications the job asks for that the profile doesn't evidence, with importance and why it matters for this role.
- learning_plan: 2–5 focused learning areas with concrete actions (courses, practice projects, certifications) and a realistic timeframe. This is suggested learning, not existing experience.
- profile_improvements: suggestions to strengthen the profile, e.g. "If you've used X at work, add it to the relevant role".
Clearly separate verified experience from suggested learning. Do not assume the candidate has anything not in the profile.`,
    maxTokens: 6_000,
    effort: "medium",
    dedupeKey: `gap:${ctx.application.id}`,
  });
  return { data, warnings: [] as string[] };
}

const FOLLOW_UP_GUIDANCE: Record<FollowUpKind, string> = {
  after_application: "A polite follow-up about one to two weeks after applying, restating interest briefly and asking about the timeline.",
  thank_interviewer: "A thank-you note sent within 24 hours of an interview, referencing something specific discussed (use the candidate's notes if provided; otherwise keep it general) and reaffirming fit.",
  request_update: "A courteous request for an update on the hiring process after the expected timeline has passed.",
  accept_interview: "A reply accepting an interview invitation, confirming the proposed time (use a placeholder if unknown) and asking any practical questions.",
  decline_offer: "A gracious message declining a job offer, thanking them and leaving the door open, without unnecessary detail.",
  accept_offer: "A professional message accepting a job offer, confirming key details with placeholders (start date, salary as offered) and expressing appreciation.",
};

export async function generateFollowUpEmail(ctx: ToolContext, kind: FollowUpKind, notes: string) {
  const label = FOLLOW_UP_KINDS.find((k) => k.value === kind)?.label ?? kind;
  const app = ctx.application;
  const facts = [
    app.recruiter_name ? `Recruiter/contact name: ${app.recruiter_name}` : "",
    app.application_date ? `Applied on: ${app.application_date}` : "",
    app.offered_salary ? `Offered salary: ${app.offered_salary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const { data } = await generateStructured({
    feature: "toolkit.follow_up_email",
    userId: ctx.userId,
    schema: FollowUpEmailSchema,
    context: context(ctx),
    task: `Write a short professional email: ${label}. ${FOLLOW_UP_GUIDANCE[kind]}
Role: ${app.job_title}${app.company_name ? ` at ${app.company_name}` : ""}.
${facts ? `Known details:\n${facts.replace(/[<>]/g, "")}` : ""}
${notes.trim() ? `The candidate's notes:\n${wrapUntrusted("candidate_request", notes.slice(0, 800))}` : ""}
Return a subject and a body (80–160 words) signed with the candidate's name. Use [placeholders] for anything unknown. No invented facts.`,
    maxTokens: 2_000,
    effort: "low",
    dedupeKey: `followup:${app.id}:${kind}`,
  });
  return { data, warnings: [] as string[] };
}

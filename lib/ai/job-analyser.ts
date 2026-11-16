import "server-only";

import { z } from "zod";
import type { CandidateBundle, JobApplication } from "@/lib/db/types";
import { generateStructured } from "./client";
import { buildApplicationContext, buildCandidateContext } from "./prompts";

const list = z.array(z.string());

export const MATCH_LEVELS = ["strong", "partial", "not_evidenced", "missing_qualification"] as const;
export type MatchLevel = (typeof MATCH_LEVELS)[number];

export const JobAnalysisSchema = z.object({
  job: z.object({
    job_title: z.string().nullable(),
    company_name: z.string().nullable(),
    location: z.string().nullable(),
    employment_type: z.string().nullable(),
    salary_range: z.string().nullable(),
    seniority: z.string().nullable(),
    summary: z.string(),
    responsibilities: list,
    required_skills: list,
    preferred_skills: list,
    required_experience: list,
    education_requirements: list,
    certifications: list,
    soft_skills: list,
    industry_experience: list,
    ats_keywords: list,
    key_phrases: list,
    differentiators: list,
  }),
  requirements: z.array(
    z.object({
      requirement: z.string(),
      category: z.enum(["technical_skill", "experience", "education", "certification", "soft_skill", "industry", "other"]),
      importance: z.enum(["required", "preferred"]),
      evidence: z.string().nullable(),
      evidence_refs: list,
      match: z.enum(MATCH_LEVELS),
      explanation: z.string(),
    }),
  ),
  strengths: list,
  gaps: list,
  overall: z.object({
    rating: z.enum(["strong", "good", "moderate", "limited"]),
    headline: z.string(),
    explanation: z.string(),
  }),
  clarifying_questions: z.array(z.object({ skill: z.string(), question: z.string() })),
  recommendations: list,
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export interface StoredJobAnalysis extends JobAnalysis {
  meta: { generated_at: string; model: string; counts: Record<MatchLevel, number> };
}

const TASK = `Analyse the job advertisement in <job_advertisement> and compare it with the verified candidate profile in <candidate_profile>.

1. job: extract the role's structured details. Lists should be concise items (a few words to one sentence each), copied or closely paraphrased from the advertisement. ats_keywords: 10–25 specific terms an applicant tracking system is likely to screen for (skills, tools, qualifications, domain terms). key_phrases: distinctive phrases the employer uses. differentiators: qualifications or experiences that would make an applicant stand out. Use null for details the advertisement doesn't state.

2. requirements: build a requirements matrix of 6–20 rows covering every important required and preferred qualification, skill and experience. For each:
   - evidence: quote or closely summarise the specific evidence from the candidate profile (role, project, qualification, skill), or null if there is none.
   - evidence_refs: the profile refs (exp_1, edu_1, proj_1, cert_1, extra_1) that support it; [] if none.
   - match: "strong" (clear, direct evidence), "partial" (related or transferable evidence, or less depth than asked), "not_evidenced" (nothing in the profile shows it — the candidate may still have it), or "missing_qualification" (a mandatory credential, licence, degree or certification the profile does not contain).
   - explanation: one sentence on why.
   Base every judgement only on the profile. Do not assume skills that aren't stated. Years of experience must be calculated from the dates in the profile, not guessed.

3. strengths: the candidate's 3–6 most relevant strengths for this role, each tied to real evidence.
4. gaps: honest gaps or weaker areas (3–6), without being discouraging.
5. overall: an overall suitability rating (strong / good / moderate / limited), a short headline and a 2–4 sentence explanation. This is a qualitative assessment to help the candidate decide and prepare — not a prediction of being hired, and not a reason to reject the role.
6. clarifying_questions: for important requirements that are not evidenced, ask whether the candidate has relevant experience not yet in their profile (e.g. "Have you used React in a work or personal project?"). Up to 6.
7. recommendations: 2–5 practical suggestions for strengthening this application (which experience to emphasise, what to add to the profile if genuinely true, how to address gaps).`;

export async function analyseJob(userId: string, bundle: CandidateBundle, job: JobApplication): Promise<StoredJobAnalysis> {
  const { text, refs } = buildCandidateContext(bundle);
  const result = await generateStructured({
    feature: "job.analyse",
    userId,
    schema: JobAnalysisSchema,
    context: buildApplicationContext(text, job),
    task: TASK,
    maxTokens: 16_000,
    effort: "medium",
    dedupeKey: `analyse:${job.id}`,
  });
  return finaliseAnalysis(result.data, refs, result.model);
}

/** Integrity post-processing: drop unknown refs, never claim a match without evidence. */
export function finaliseAnalysis(
  data: JobAnalysis,
  refs: { experiences: Map<string, string>; education: Map<string, string>; certifications: Map<string, string>; projects: Map<string, string>; extras: Map<string, string> },
  model: string,
): StoredJobAnalysis {
  const known = new Set([...refs.experiences.keys(), ...refs.education.keys(), ...refs.certifications.keys(), ...refs.projects.keys(), ...refs.extras.keys()]);
  const requirements = data.requirements.map((r) => {
    const evidence = r.evidence?.trim() || null;
    const evidence_refs = r.evidence_refs.filter((ref) => known.has(ref));
    let match = r.match;
    if ((match === "strong" || match === "partial") && !evidence) match = "not_evidenced";
    return { ...r, evidence, evidence_refs, match };
  });
  const counts = { strong: 0, partial: 0, not_evidenced: 0, missing_qualification: 0 } as Record<MatchLevel, number>;
  for (const r of requirements) counts[r.match]++;
  return {
    ...data,
    job: { ...data.job, ats_keywords: [...new Set(data.job.ats_keywords)].slice(0, 30) },
    requirements,
    meta: { generated_at: new Date().toISOString(), model, counts },
  };
}

import "server-only";

import { z } from "zod";
import type { CandidateBundle, JobApplication } from "@/lib/db/types";
import { generateStructured } from "./client";
import { buildApplicationContext, buildCandidateContext } from "./prompts";

export const INTERVIEW_CATEGORIES = ["technical", "behavioural", "situational", "experience", "company_role"] as const;

export const InterviewPrepSchema = z.object({
  questions: z.array(
    z.object({
      category: z.enum(INTERVIEW_CATEGORIES),
      question: z.string(),
      why_asked: z.string(),
      answer_format: z.enum(["star", "direct"]),
      star: z.object({ situation: z.string(), task: z.string(), action: z.string(), result: z.string() }).nullable(),
      answer: z.string().nullable(),
      evidence_refs: z.array(z.string()),
      evidence_gap: z.string().nullable(),
    }),
  ),
  questions_to_ask: z.array(z.string()),
  preparation_tips: z.array(z.string()),
});

export type InterviewPrep = z.infer<typeof InterviewPrepSchema>;

const TASK = `Prepare the candidate in <candidate_profile> for an interview for the role in <job_advertisement>.

Create 12–16 likely interview questions grounded in this specific advertisement, spread across these categories:
- technical: skills, tools and methods the job requires
- behavioural: past behaviour ("Tell me about a time...")
- situational: hypothetical scenarios typical of this role
- experience: questions about the candidate's background and specific roles
- company_role: motivation for this role and organisation (use only what the advertisement says about the organisation)

For each question:
- why_asked: one sentence on what the interviewer is assessing.
- answer_format: "star" for behavioural/experience questions where a real example exists; otherwise "direct".
- star: for STAR answers, Situation, Task, Action and Result written in the first person, drawn ONLY from a real role, project or achievement in the profile. The Result must only state outcomes present in the profile; if the profile has no measurable outcome, describe the qualitative outcome honestly and never invent numbers. null for direct answers.
- answer: for direct answers, a concise suggested answer in the first person using only verified experience. null for STAR answers.
- evidence_refs: the profile refs used (exp_1, proj_1 ...).
- evidence_gap: if the profile has no genuine evidence for what the question asks, set this to a short, honest note on how the candidate could approach the question (e.g. acknowledging limited exposure and describing transferable experience or how they'd learn) and keep the suggested answer honest about the gap. null otherwise.

Also provide questions_to_ask (4–6 thoughtful questions for the candidate to ask the interviewer, based on the advertisement) and preparation_tips (3–5 practical, role-specific tips).`;

export async function generateInterviewPrep(userId: string, bundle: CandidateBundle, application: JobApplication): Promise<InterviewPrep> {
  const { text, refs } = buildCandidateContext(bundle);
  const result = await generateStructured({
    feature: "interview.prepare",
    userId,
    schema: InterviewPrepSchema,
    context: buildApplicationContext(text, application),
    task: TASK,
    maxTokens: 16_000,
    effort: "medium",
    dedupeKey: `interview:${application.id}`,
  });
  const known = new Set([...refs.experiences.keys(), ...refs.education.keys(), ...refs.projects.keys(), ...refs.certifications.keys(), ...refs.extras.keys()]);
  return {
    ...result.data,
    questions: result.data.questions.map((q) => {
      const evidence_refs = q.evidence_refs.filter((r) => known.has(r));
      // A STAR story with no real evidence behind it is not allowed.
      if (q.answer_format === "star" && evidence_refs.length === 0 && !q.evidence_gap) {
        return { ...q, evidence_refs, evidence_gap: "No specific example from your profile supports this answer yet. Use a real example of your own." };
      }
      return { ...q, evidence_refs };
    }),
  };
}

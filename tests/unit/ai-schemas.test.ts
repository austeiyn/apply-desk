/**
 * Every structured-output schema the app sends must fit the Claude API's
 * documented complexity limits, or the API rejects the request with
 * "Schema is too complex for compilation" (400). The limits are per request:
 * at most 24 optional properties and 16 properties with union types (anyOf
 * or type arrays such as ["string", "null"]). Each request sends one schema.
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import * as assistant from "@/lib/ai/application-assistant";
import { CoverLetterSchema } from "@/lib/ai/cover-letter-generator";
import { CvExtractionAiSchema, fromAiExtraction } from "@/lib/ai/cv-extractor";
import { InterviewPrepSchema } from "@/lib/ai/interview-preparation";
import { JobAnalysisSchema } from "@/lib/ai/job-analyser";
import { ResumeAiSchema, SectionSchema } from "@/lib/ai/resume-generator";

type Json = Record<string, unknown>;

export function schemaComplexity(root: Json) {
  const defs = (root.$defs ?? root.definitions ?? {}) as Record<string, Json>;
  const resolve = (node: Json): Json => (typeof node.$ref === "string" ? (defs[node.$ref.split("/").pop()!] ?? node) : node);
  let optional = 0;
  let unions = 0;
  const seen = new Set<Json>();
  const walk = (raw: Json) => {
    const node = resolve(raw);
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (node.type === "object" && node.properties) {
      const required = new Set((node.required as string[]) ?? []);
      for (const [name, child] of Object.entries(node.properties as Record<string, Json>)) {
        if (!required.has(name)) optional++;
        const c = resolve(child);
        if (Array.isArray(c.anyOf) || Array.isArray(c.type)) unions++;
        walk(child);
      }
    }
    if (node.items) walk(node.items as Json);
    for (const key of ["anyOf", "allOf"]) for (const c of (node[key] as Json[] | undefined) ?? []) walk(c);
  };
  walk(root);
  return { optional, unions };
}

const SCHEMAS = {
  "cv.extract": CvExtractionAiSchema,
  "job.analyse": JobAnalysisSchema,
  "resume.generate": ResumeAiSchema,
  "resume.section": SectionSchema,
  "cover_letter.generate": CoverLetterSchema,
  "interview.prepare": InterviewPrepSchema,
  "toolkit.email": assistant.ApplicationEmailSchema,
  "toolkit.summary": assistant.ProfessionalSummarySchema,
  "toolkit.answers": assistant.ApplicationAnswersSchema,
  "toolkit.skill_gap": assistant.SkillGapSchema,
  "toolkit.follow_up": assistant.FollowUpEmailSchema,
};

describe("structured output schemas fit the API's complexity limits", () => {
  for (const [feature, schema] of Object.entries(SCHEMAS)) {
    it(feature, () => {
      const sent = (betaZodOutputFormat(schema as never) as unknown as { schema: Json }).schema;
      const { optional, unions } = schemaComplexity(sent);
      expect(unions, `${feature}: properties with union types`).toBeLessThanOrEqual(16);
      expect(optional, `${feature}: optional properties`).toBeLessThanOrEqual(24);
    });
  }
});

describe("CV extraction placeholders", () => {
  it("turns empty strings from the model back into nulls", () => {
    const out = fromAiExtraction({
      personal: { full_name: "Aroha", professional_title: "", email: " ", phone: "", city: "Wellington", country: "", linkedin_url: "", portfolio_url: "", github_url: "", website_url: "" },
      professional_summary: "",
      years_experience: null,
      work_experiences: [
        { company: "Acme", job_title: "Dev", employment_type: null, location: "", start_date: "2020-01", end_date: "", is_current: true, responsibilities: [], achievements: [], technologies: [] },
      ],
      education: [{ institution: "Uni", qualification: "BSc", field_of_study: "", start_date: "", graduation_date: "2019", achievements: [] }],
      skills: [],
      certifications: [{ name: "Cert", institution: "", issue_date: "2022", expiry_date: "" }],
      projects: [{ title: "P", description: "d", technologies: [], url: "" }],
      extras: [{ kind: "award", title: "A", organisation: "", date: "", description: "" }],
      notes: [],
    });
    expect(out.personal).toMatchObject({ full_name: "Aroha", professional_title: null, email: null, city: "Wellington", country: null });
    expect(out.professional_summary).toBeNull();
    expect(out.work_experiences[0]).toMatchObject({ location: null, start_date: "2020-01", end_date: null });
    expect(out.education[0]).toMatchObject({ field_of_study: null, start_date: null, graduation_date: "2019" });
    expect(out.certifications[0]).toMatchObject({ institution: null, expiry_date: null });
    expect(out.projects[0]!.url).toBeNull();
    expect(out.extras[0]).toMatchObject({ organisation: null, date: null });
  });
});

import { z } from "zod";
import { ACCENT_COLOURS, RESUME_TEMPLATES } from "@/lib/documents/templates";

export const SECTION_KEYS = ["summary", "skills", "experience", "education", "certifications", "projects", "additional"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** Standard, ATS-recognisable section headings. */
export const SECTION_HEADINGS: Record<SectionKey, string> = {
  summary: "Professional Summary",
  skills: "Core Skills",
  experience: "Professional Experience",
  education: "Education",
  certifications: "Certifications",
  projects: "Projects",
  additional: "Additional Information",
};

export const DEFAULT_SECTION_ORDER: SectionKey[] = ["summary", "skills", "experience", "education", "certifications", "projects", "additional"];

const id = z.string().min(1).max(64);
const shortText = (max: number) => z.string().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const ResumeContentSchema = z.object({
  version: z.literal(1),
  contact: z.object({
    full_name: shortText(200),
    headline: shortText(200),
    email: shortText(320),
    phone: shortText(50),
    location: shortText(200),
    links: z.array(z.object({ label: shortText(40), url: shortText(2048) })).max(6),
  }),
  summary: shortText(3000),
  skills: z.array(shortText(100)).max(60),
  experience: z
    .array(
      z.object({
        id,
        source_id: z.string().nullable(),
        job_title: shortText(200),
        company: shortText(200),
        location: shortText(200).nullable(),
        start_date: isoDate,
        end_date: isoDate,
        is_current: z.boolean(),
        bullets: z.array(shortText(600)).max(20),
      }),
    )
    .max(30),
  education: z
    .array(
      z.object({
        id,
        source_id: z.string().nullable(),
        qualification: shortText(200),
        field_of_study: shortText(200).nullable(),
        institution: shortText(200),
        start_date: isoDate,
        end_date: isoDate,
        details: z.array(shortText(400)).max(10),
      }),
    )
    .max(15),
  certifications: z
    .array(z.object({ id, source_id: z.string().nullable(), name: shortText(200), issuer: shortText(200).nullable(), date: isoDate }))
    .max(30),
  projects: z
    .array(
      z.object({
        id,
        source_id: z.string().nullable(),
        title: shortText(200),
        url: shortText(2048).nullable(),
        technologies: z.array(shortText(100)).max(30),
        bullets: z.array(shortText(600)).max(10),
      }),
    )
    .max(15),
  additional: z.array(z.object({ id, heading: shortText(80), items: z.array(shortText(400)).max(15) })).max(6),
  section_order: z.array(z.enum(SECTION_KEYS)),
  hidden_sections: z.array(z.enum(SECTION_KEYS)),
  /** Visual style (template and accent). Optional: older resumes use Classic. */
  style: z.object({ template: z.enum(RESUME_TEMPLATES), accent: z.enum(ACCENT_COLOURS).optional() }).optional(),
  meta: z
    .object({
      application_id: z.string().nullable().optional(),
      job_title: z.string().nullable().optional(),
      company_name: z.string().nullable().optional(),
      generated_at: z.string().optional(),
      model: z.string().optional(),
      skill_gaps: z.array(z.object({ skill: z.string(), note: z.string() })).optional(),
      warnings: z.array(z.object({ section: z.string(), item_id: z.string().nullable(), message: z.string() })).optional(),
      tailoring_notes: z.array(z.string()).optional(),
      preferences: z.record(z.string(), z.unknown()).optional(),
    })
    .default({}),
});

export type ResumeContent = z.infer<typeof ResumeContentSchema>;
export type ResumeExperience = ResumeContent["experience"][number];
export type ResumeEducation = ResumeContent["education"][number];
export type ResumeProject = ResumeContent["projects"][number];

export const resumePreferencesSchema = z.object({
  length: z.enum(["one_page", "two_pages"]).default("two_pages"),
  emphasis: z.string().trim().max(500).optional().default(""),
  includeProjects: z.boolean().default(true),
  includeCertifications: z.boolean().default(true),
  includeAdditional: z.boolean().default(true),
});
export type ResumePreferences = z.infer<typeof resumePreferencesSchema>;

export function newItemId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Plain-text serialisation used for version comparison. */
export function resumeToPlainText(c: ResumeContent): string {
  const lines: string[] = [];
  lines.push(c.contact.full_name, c.contact.headline, [c.contact.email, c.contact.phone, c.contact.location].filter(Boolean).join(" | "));
  for (const key of c.section_order) {
    if (c.hidden_sections.includes(key)) continue;
    switch (key) {
      case "summary":
        if (c.summary) lines.push("", SECTION_HEADINGS.summary.toUpperCase(), c.summary);
        break;
      case "skills":
        if (c.skills.length) lines.push("", SECTION_HEADINGS.skills.toUpperCase(), c.skills.join(" · "));
        break;
      case "experience":
        if (c.experience.length) lines.push("", SECTION_HEADINGS.experience.toUpperCase());
        for (const e of c.experience) {
          lines.push(`${e.job_title} — ${e.company}${e.location ? `, ${e.location}` : ""} (${e.start_date ?? ""} – ${e.is_current ? "Present" : (e.end_date ?? "")})`);
          for (const b of e.bullets) lines.push(`• ${b}`);
        }
        break;
      case "education":
        if (c.education.length) lines.push("", SECTION_HEADINGS.education.toUpperCase());
        for (const e of c.education) {
          lines.push(`${e.qualification}${e.field_of_study ? `, ${e.field_of_study}` : ""} — ${e.institution}`);
          for (const d of e.details) lines.push(`• ${d}`);
        }
        break;
      case "certifications":
        if (c.certifications.length) lines.push("", SECTION_HEADINGS.certifications.toUpperCase());
        for (const x of c.certifications) lines.push(`${x.name}${x.issuer ? ` — ${x.issuer}` : ""}`);
        break;
      case "projects":
        if (c.projects.length) lines.push("", SECTION_HEADINGS.projects.toUpperCase());
        for (const p of c.projects) {
          lines.push(p.title);
          for (const b of p.bullets) lines.push(`• ${b}`);
        }
        break;
      case "additional":
        for (const a of c.additional) {
          lines.push("", a.heading.toUpperCase());
          for (const i of a.items) lines.push(`• ${i}`);
        }
        break;
    }
  }
  return lines.join("\n");
}

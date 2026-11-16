import { z } from "zod";
import { EMPLOYMENT_TYPE_VALUES, EXTRA_KIND_VALUES, PROFICIENCY_VALUES, SKILL_CATEGORY_VALUES } from "@/lib/constants";
import { longText, optionalEmail, optionalMonth, optionalText, optionalUrl, requiredText, stringList } from "./common";

export const personalSchema = z.object({
  fullName: requiredText(200, "Enter your full name."),
  professionalTitle: optionalText(200),
  contactEmail: optionalEmail,
  phone: optionalText(50),
  location: optionalText(200),
  country: optionalText(100),
  linkedinUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  githubUrl: optionalUrl,
  websiteUrl: optionalUrl,
});

const yearsField = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 70) {
      ctx.addIssue({ code: "custom", message: "Enter a number between 0 and 70." });
      return z.NEVER;
    }
    return Math.round(n * 10) / 10;
  });

export const careerSchema = z.object({
  professionalSummary: optionalText(5000),
  yearsExperience: yearsField,
  currentOccupation: optionalText(200),
  preferredJobTitles: stringList(20),
  preferredIndustries: stringList(20),
  preferredEmploymentTypes: z.array(z.enum(EMPLOYMENT_TYPE_VALUES)).max(10).default([]),
  preferredLocations: optionalText(500),
  workArrangements: z.array(z.enum(["remote", "hybrid", "onsite"])).max(3).default([]),
  salaryExpectation: optionalText(200),
});

const dateOrder = <T extends { startDate: string | null; endDate: string | null }>(v: T) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate;

export const experienceSchema = z
  .object({
    company: requiredText(200, "Enter the company name."),
    jobTitle: requiredText(200, "Enter your job title."),
    employmentType: z.enum(EMPLOYMENT_TYPE_VALUES).optional().nullable().or(z.literal("").transform(() => null)),
    location: optionalText(200),
    startDate: optionalMonth,
    endDate: optionalMonth,
    isCurrent: z.boolean().default(false),
    responsibilities: longText(10000),
    achievements: longText(10000),
    technologies: stringList(100),
  })
  .transform((v) => (v.isCurrent ? { ...v, endDate: null } : v))
  .refine(dateOrder, { path: ["endDate"], message: "End date must be after the start date." });

export const educationSchema = z
  .object({
    institution: requiredText(200, "Enter the institution."),
    qualification: requiredText(200, "Enter the qualification."),
    fieldOfStudy: optionalText(200),
    startDate: optionalMonth,
    graduationDate: optionalMonth,
    achievements: longText(5000),
  })
  .refine((v) => !v.startDate || !v.graduationDate || v.graduationDate >= v.startDate, {
    path: ["graduationDate"],
    message: "Graduation must be after the start date.",
  });

export const skillsAddSchema = z.object({
  names: stringList(50, 100).refine((v) => v.length > 0, "Enter at least one skill."),
  category: z.enum(SKILL_CATEGORY_VALUES),
  proficiency: z.enum(PROFICIENCY_VALUES).optional().nullable().or(z.literal("").transform(() => null)),
});

export const skillUpdateSchema = z.object({
  name: requiredText(100, "Enter a skill."),
  category: z.enum(SKILL_CATEGORY_VALUES),
  proficiency: z.enum(PROFICIENCY_VALUES).optional().nullable().or(z.literal("").transform(() => null)),
});

export const certificationSchema = z
  .object({
    name: requiredText(200, "Enter the certification name."),
    institution: optionalText(200),
    issueDate: optionalMonth,
    expiryDate: optionalMonth,
    credentialId: optionalText(200),
    credentialUrl: optionalUrl,
  })
  .refine((v) => !v.issueDate || !v.expiryDate || v.expiryDate >= v.issueDate, {
    path: ["expiryDate"],
    message: "Expiry must be after the issue date.",
  });

export const projectSchema = z
  .object({
    title: requiredText(200, "Enter a project title."),
    role: optionalText(200),
    description: longText(5000),
    technologies: stringList(100),
    projectUrl: optionalUrl,
    startDate: optionalMonth,
    endDate: optionalMonth,
  })
  .refine(dateOrder, { path: ["endDate"], message: "End date must be after the start date." });

export const extraSchema = z.object({
  kind: z.enum(EXTRA_KIND_VALUES),
  title: requiredText(300, "Enter a title."),
  organisation: optionalText(200),
  date: optionalMonth,
  description: longText(5000),
  url: optionalUrl,
});

export type PersonalInput = z.input<typeof personalSchema>;
export type CareerInput = z.input<typeof careerSchema>;
export type ExperienceInput = z.input<typeof experienceSchema>;
export type EducationInput = z.input<typeof educationSchema>;
export type SkillsAddInput = z.input<typeof skillsAddSchema>;
export type SkillUpdateInput = z.input<typeof skillUpdateSchema>;
export type CertificationInput = z.input<typeof certificationSchema>;
export type ProjectInput = z.input<typeof projectSchema>;
export type ExtraInput = z.input<typeof extraSchema>;

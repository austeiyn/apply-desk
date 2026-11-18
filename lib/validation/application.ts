import { z } from "zod";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { longText, optionalDate, optionalEmail, optionalText } from "./common";

const jobUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    try {
      const u = new URL(v);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      return u.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a full link starting with https://" });
      return z.NEVER;
    }
  });

/** Stored when the title is left blank; job analysis replaces it with the advertised title. */
export const UNTITLED_JOB = "Untitled role";

export const jobDetailsSchema = z
  .object({
  jobUrl,
  source: z.enum(["url", "manual"]).default("manual"),
  jobTitle: optionalText(300),
  companyName: optionalText(300).transform((v) => v ?? ""),
  location: optionalText(300),
  employmentType: optionalText(100),
  salaryRange: optionalText(200),
  deadline: optionalDate,
  jobDescription: longText(60000),
  responsibilities: longText(20000),
  requiredQualifications: longText(20000),
  requiredSkills: longText(20000),
  preferredQualifications: longText(20000),
  })
  // The title may be left blank when the advertisement text is pasted: the
  // analysis reads it from the description (see app/api/ai/analyse).
  .superRefine((v, ctx) => {
    if (!v.jobTitle && v.jobDescription.length < 80) {
      ctx.addIssue({ code: "custom", path: ["jobTitle"], message: "Enter the job title, or paste the full job description below and we'll fill it in." });
    }
  })
  .transform((v) => ({ ...v, jobTitle: v.jobTitle ?? UNTITLED_JOB }));

export const trackingSchema = z.object({
  applicationStatus: z.enum(APPLICATION_STATUSES),
  applicationDate: optionalDate,
  deadline: optionalDate,
  recruiterName: optionalText(200),
  recruiterEmail: optionalEmail,
  recruiterPhone: optionalText(50),
  nextAction: optionalText(500),
  nextActionDate: optionalDate,
  followUpDate: optionalDate,
  offeredSalary: optionalText(200),
  finalOutcome: optionalText(2000),
  notes: longText(20000),
});

export const importUrlSchema = z.object({ url: z.string().trim().min(1, "Paste a job advertisement link.").max(2048) });

export type JobDetailsInput = z.input<typeof jobDetailsSchema>;
export type TrackingInput = z.input<typeof trackingSchema>;

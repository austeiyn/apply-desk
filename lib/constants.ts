export const APP_NAME = "ApplyDesk";

export const APPLICATION_STATUSES = [
  "interested",
  "preparing",
  "ready",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/**
 * Pipeline colours, left to right: slate (not started) -> sun, ocean, grape,
 * bloom, coral, cyan (in motion) -> mint (offer). Rose and zinc close it out.
 * Text is always the 700 step on a 50 tint (WCAG AA).
 */
export const STATUS_META: Record<ApplicationStatus, { label: string; dot: string; badge: string }> = {
  interested: { label: "Interested", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 ring-slate-200" },
  preparing: { label: "Preparing Application", dot: "bg-sun-500", badge: "bg-sun-50 text-sun-700 ring-sun-200" },
  ready: { label: "Ready to Apply", dot: "bg-ocean-500", badge: "bg-ocean-50 text-ocean-700 ring-ocean-200" },
  applied: { label: "Applied", dot: "bg-grape-500", badge: "bg-grape-50 text-grape-700 ring-grape-200" },
  screening: { label: "Screening", dot: "bg-bloom-500", badge: "bg-bloom-50 text-bloom-700 ring-bloom-200" },
  interview: { label: "Interview", dot: "bg-coral-500", badge: "bg-coral-50 text-coral-700 ring-coral-200" },
  assessment: { label: "Assessment", dot: "bg-cyan-500", badge: "bg-cyan-50 text-cyan-800 ring-cyan-200" },
  offer: { label: "Offer", dot: "bg-mint-500", badge: "bg-mint-50 text-mint-700 ring-mint-200" },
  rejected: { label: "Rejected", dot: "bg-rose-400", badge: "bg-rose-50 text-rose-700 ring-rose-200" },
  withdrawn: { label: "Withdrawn", dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
};

/** Statuses that count as an "active" job-search pipeline. */
export const ACTIVE_STATUSES: ApplicationStatus[] = ["preparing", "ready", "applied", "screening", "interview", "assessment", "offer"];
export const SUBMITTED_STATUSES: ApplicationStatus[] = ["applied", "screening", "interview", "assessment", "offer", "rejected"];

export const APPLICATION_FILTERS = {
  all: { label: "All applications", statuses: null },
  active: { label: "Active", statuses: ACTIVE_STATUSES },
  interviews: { label: "Interviews", statuses: ["interview", "assessment"] as ApplicationStatus[] },
  offers: { label: "Offers", statuses: ["offer"] as ApplicationStatus[] },
  rejected: { label: "Rejected", statuses: ["rejected"] as ApplicationStatus[] },
  saved: { label: "Saved jobs", statuses: ["interested"] as ApplicationStatus[] },
} as const;
export type ApplicationFilter = keyof typeof APPLICATION_FILTERS;

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "internship", label: "Internship" },
  { value: "freelance", label: "Freelance" },
  { value: "volunteer", label: "Volunteer" },
  { value: "apprenticeship", label: "Apprenticeship" },
  { value: "other", label: "Other" },
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];
export const EMPLOYMENT_TYPE_VALUES = EMPLOYMENT_TYPES.map((e) => e.value) as [EmploymentType, ...EmploymentType[]];

export function employmentTypeLabel(value: string | null | undefined): string {
  return EMPLOYMENT_TYPES.find((e) => e.value === value)?.label ?? value ?? "";
}

export const WORK_ARRANGEMENTS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
] as const;

export const SKILL_CATEGORIES = [
  { value: "technical", label: "Technical" },
  { value: "tool", label: "Tools & technologies" },
  { value: "soft", label: "Soft skills" },
  { value: "industry", label: "Industry-specific" },
  { value: "language", label: "Languages" },
  { value: "other", label: "Other" },
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number]["value"];
export const SKILL_CATEGORY_VALUES = SKILL_CATEGORIES.map((s) => s.value) as [SkillCategory, ...SkillCategory[]];

export const PROFICIENCY_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
] as const;
export type Proficiency = (typeof PROFICIENCY_LEVELS)[number]["value"];
export const PROFICIENCY_VALUES = PROFICIENCY_LEVELS.map((p) => p.value) as [Proficiency, ...Proficiency[]];

export const EXTRA_KINDS = [
  { value: "training", label: "Training", singular: "training course" },
  { value: "award", label: "Awards", singular: "award" },
  { value: "volunteer", label: "Volunteer experience", singular: "volunteer role" },
  { value: "publication", label: "Publications", singular: "publication" },
] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number]["value"];
export const EXTRA_KIND_VALUES = EXTRA_KINDS.map((e) => e.value) as [ExtraKind, ...ExtraKind[]];

export const COVER_LETTER_TONES = [
  { value: "professional", label: "Professional and confident", description: "Polished, assured and businesslike." },
  { value: "friendly", label: "Friendly and approachable", description: "Warm and personable while staying professional." },
  { value: "enthusiastic", label: "Enthusiastic", description: "Energetic and motivated, without overstatement." },
  { value: "executive", label: "Executive and sophisticated", description: "Strategic, measured and senior in register." },
  { value: "concise", label: "Concise and direct", description: "Short, plain and to the point." },
] as const;
export type CoverLetterTone = (typeof COVER_LETTER_TONES)[number]["value"];
export const COVER_LETTER_TONE_VALUES = COVER_LETTER_TONES.map((t) => t.value) as [CoverLetterTone, ...CoverLetterTone[]];

export const INTERVIEW_TYPES = [
  { value: "phone", label: "Phone screen" },
  { value: "video", label: "Video call" },
  { value: "onsite", label: "In person" },
  { value: "technical", label: "Technical" },
  { value: "panel", label: "Panel" },
  { value: "assessment", label: "Assessment" },
  { value: "other", label: "Other" },
] as const;
export const INTERVIEW_TYPE_VALUES = INTERVIEW_TYPES.map((t) => t.value) as [
  (typeof INTERVIEW_TYPES)[number]["value"],
  ...(typeof INTERVIEW_TYPES)[number]["value"][],
];

export const INTERVIEW_OUTCOMES = [
  { value: "pending", label: "Upcoming / pending" },
  { value: "progressed", label: "Progressed" },
  { value: "not_progressed", label: "Not progressed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const FOLLOW_UP_KINDS = [
  { value: "after_application", label: "Follow up after applying" },
  { value: "thank_interviewer", label: "Thank an interviewer" },
  { value: "request_update", label: "Ask for an update" },
  { value: "accept_interview", label: "Respond to an interview invitation" },
  { value: "decline_offer", label: "Decline an offer professionally" },
  { value: "accept_offer", label: "Accept an offer professionally" },
] as const;
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number]["value"];
export const FOLLOW_UP_KIND_VALUES = FOLLOW_UP_KINDS.map((k) => k.value) as [FollowUpKind, ...FollowUpKind[]];

export const DEFAULT_APPLICATION_QUESTIONS = [
  "Why do you want to work here?",
  "Why are you interested in this position?",
  "What makes you suitable for this position?",
  "What are your greatest strengths?",
  "Describe a challenging project you completed.",
  "What are your salary expectations?",
  "When can you start?",
];

export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const CV_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;
export type CvMimeType = keyof typeof CV_MIME_TYPES;

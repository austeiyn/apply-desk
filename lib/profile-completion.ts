import type { CandidateBundle } from "@/lib/db/types";

export interface CompletionItem {
  key: string;
  label: string;
  weight: number;
  done: boolean;
  /** 0..1 partial credit */
  progress: number;
  href: string;
}

export interface ProfileCompletion {
  percent: number;
  items: CompletionItem[];
  missing: CompletionItem[];
}

const has = (v: string | null | undefined) => Boolean(v && v.trim().length > 0);

/**
 * Weighted profile completeness. Weights reflect what most improves the
 * quality of generated documents (experience, skills, summary).
 */
export function computeProfileCompletion(bundle: Pick<CandidateBundle, "profile" | "candidate" | "experiences" | "education" | "skills">): ProfileCompletion {
  const { profile, candidate, experiences, education, skills } = bundle;
  const detailedExperience = experiences.some((e) => has(e.responsibilities) || has(e.achievements));
  const skillProgress = Math.min(skills.length / 8, 1);

  const items: CompletionItem[] = [
    { key: "name", label: "Add your full name", weight: 5, progress: has(profile.full_name) ? 1 : 0, href: "/dashboard/profile?tab=personal" },
    { key: "title", label: "Add a professional title", weight: 10, progress: has(candidate.professional_title) ? 1 : 0, href: "/dashboard/profile?tab=personal" },
    {
      key: "contact",
      label: "Add contact details (phone or email)",
      weight: 5,
      progress: has(candidate.phone) || has(candidate.contact_email) ? 1 : 0,
      href: "/dashboard/profile?tab=personal",
    },
    {
      key: "location",
      label: "Add your location",
      weight: 5,
      progress: has(candidate.location) || has(candidate.country) ? 1 : 0,
      href: "/dashboard/profile?tab=personal",
    },
    { key: "summary", label: "Write a professional summary", weight: 15, progress: has(candidate.professional_summary) ? 1 : 0, href: "/dashboard/profile?tab=career" },
    { key: "experience", label: "Add your work experience", weight: 20, progress: experiences.length > 0 ? 1 : 0, href: "/dashboard/profile?tab=experience" },
    {
      key: "experience_detail",
      label: "Describe responsibilities and achievements",
      weight: 10,
      progress: detailedExperience ? 1 : 0,
      href: "/dashboard/profile?tab=experience",
    },
    { key: "education", label: "Add your education", weight: 10, progress: education.length > 0 ? 1 : 0, href: "/dashboard/profile?tab=education" },
    { key: "skills", label: "Add at least 8 skills", weight: 15, progress: skillProgress, href: "/dashboard/profile?tab=skills" },
    {
      key: "links",
      label: "Add LinkedIn or a portfolio link",
      weight: 3,
      progress: has(candidate.linkedin_url) || has(candidate.portfolio_url) || has(candidate.github_url) || has(candidate.website_url) ? 1 : 0,
      href: "/dashboard/profile?tab=personal",
    },
    {
      key: "preferences",
      label: "Set your preferred job titles",
      weight: 2,
      progress: candidate.preferred_job_titles.length > 0 ? 1 : 0,
      href: "/dashboard/profile?tab=career",
    },
  ].map((i) => ({ ...i, done: i.progress >= 1 }));

  const total = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.reduce((s, i) => s + i.weight * i.progress, 0);
  const percent = Math.round((earned / total) * 100);
  return { percent, items, missing: items.filter((i) => !i.done) };
}

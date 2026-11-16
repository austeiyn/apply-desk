import type { CandidateBundle } from "@/lib/db/types";
import { toLines } from "@/lib/utils";
import { buildEvidenceCorpus, isSkillEvidenced, unverifiedFigures, type EvidenceCorpus } from "./integrity";
import { DEFAULT_SECTION_ORDER, SECTION_KEYS, type ResumeContent, type ResumePreferences, type SectionKey } from "./types";

export interface ResumeAiOutput {
  headline: string;
  summary: string;
  core_skills: string[];
  experience: Array<{ ref: string; bullets: string[] }>;
  education: Array<{ ref: string; details: string[] }>;
  certifications: Array<{ ref: string }>;
  projects: Array<{ ref: string; bullets: string[] }>;
  additional: Array<{ heading: string; items: string[] }>;
  section_order: SectionKey[];
  skill_gaps: Array<{ skill: string; note: string }>;
  tailoring_notes: string[];
}

interface Refs {
  experiences: Map<string, string>;
  education: Map<string, string>;
  certifications: Map<string, string>;
  projects: Map<string, string>;
  extras: Map<string, string>;
}

function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("linkedin.")) return "LinkedIn";
    if (host.includes("github.")) return "GitHub";
    return host;
  } catch {
    return "Website";
  }
}

export function contactFromProfile(bundle: CandidateBundle, headline: string): ResumeContent["contact"] {
  const c = bundle.candidate;
  const links = [c.linkedin_url, c.portfolio_url, c.github_url, c.website_url]
    .filter((u): u is string => Boolean(u))
    .map((url) => ({ label: linkLabel(url), url }));
  return {
    full_name: bundle.profile.full_name,
    headline: headline || c.professional_title || "",
    email: c.contact_email || bundle.profile.email,
    phone: c.phone ?? "",
    location: [c.location, c.country].filter(Boolean).join(", "),
    links,
  };
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Build resume content from AI output. Factual fields (employers, titles,
 * dates, institutions, qualifications, certification names) are taken from
 * the candidate's records by reference, never from AI text. Unevidenced
 * skills are moved to skill gaps; unverifiable figures are flagged.
 */
export function assembleResume(params: {
  ai: ResumeAiOutput;
  bundle: CandidateBundle;
  refs: Refs;
  prefs: ResumePreferences;
  application: { id: string; job_title: string; company_name: string } | null;
  model: string;
}): ResumeContent {
  const { ai, bundle, refs, prefs } = params;
  const corpus: EvidenceCorpus = buildEvidenceCorpus(bundle);
  const warnings: NonNullable<ResumeContent["meta"]["warnings"]> = [];
  const skillGaps = [...ai.skill_gaps];

  const flagFigures = (text: string, section: string, itemId: string | null) => {
    const figs = unverifiedFigures(text, corpus);
    if (figs.length) {
      warnings.push({
        section,
        item_id: itemId,
        message: `Contains figures not found in your profile (${figs.join(", ")}). Check they're accurate before sending.`,
      });
    }
  };

  // Skills: keep only evidenced ones.
  const skills: string[] = [];
  for (const raw of ai.core_skills) {
    const s = clean(raw).slice(0, 100);
    if (!s || skills.some((x) => x.toLowerCase() === s.toLowerCase())) continue;
    if (isSkillEvidenced(s, corpus)) skills.push(s);
    else if (!skillGaps.some((g) => g.skill.toLowerCase() === s.toLowerCase())) {
      skillGaps.push({ skill: s, note: "Requested by the job but not found in your profile, so it wasn't added. Add it to your profile if you genuinely have it." });
    }
  }

  // Experience: every role, in the profile's (reverse-chronological) order.
  const aiExp = new Map(ai.experience.map((e) => [refs.experiences.get(e.ref), e]));
  const experience = bundle.experiences.map((row, i) => {
    const itemId = `exp_${i + 1}`;
    const fromAi = aiExp.get(row.id);
    const bullets = (fromAi?.bullets.length ? fromAi.bullets : [...toLines(row.achievements), ...toLines(row.responsibilities)].slice(0, 3))
      .map(clean)
      .filter(Boolean)
      .slice(0, 8);
    bullets.forEach((b) => flagFigures(b, "experience", itemId));
    return {
      id: itemId,
      source_id: row.id,
      job_title: row.job_title,
      company: row.company,
      location: row.location,
      start_date: row.start_date,
      end_date: row.is_current ? null : row.end_date,
      is_current: row.is_current,
      bullets,
    };
  });

  const aiEdu = new Map(ai.education.map((e) => [refs.education.get(e.ref), e]));
  const education = bundle.education.map((row, i) => {
    const details = (aiEdu.get(row.id)?.details ?? toLines(row.achievements)).map(clean).filter(Boolean).slice(0, 4);
    details.forEach((d) => flagFigures(d, "education", `edu_${i + 1}`));
    return {
      id: `edu_${i + 1}`,
      source_id: row.id,
      qualification: row.qualification,
      field_of_study: row.field_of_study,
      institution: row.institution,
      start_date: row.start_date,
      end_date: row.graduation_date,
      details,
    };
  });

  const certIds = new Set(ai.certifications.map((c) => refs.certifications.get(c.ref)).filter(Boolean));
  const certifications = prefs.includeCertifications
    ? bundle.certifications
        .filter((c) => certIds.size === 0 || certIds.has(c.id))
        .map((c, i) => ({ id: `cert_${i + 1}`, source_id: c.id, name: c.name, issuer: c.institution, date: c.issue_date }))
    : [];

  const projects = prefs.includeProjects
    ? ai.projects
        .map((p) => ({ p, row: bundle.projects.find((r) => r.id === refs.projects.get(p.ref)) }))
        .filter((x): x is { p: (typeof ai.projects)[number]; row: CandidateBundle["projects"][number] } => Boolean(x.row))
        .slice(0, 6)
        .map(({ p, row }, i) => {
          const bullets = p.bullets.map(clean).filter(Boolean).slice(0, 4);
          bullets.forEach((b) => flagFigures(b, "projects", `proj_${i + 1}`));
          return { id: `proj_${i + 1}`, source_id: row.id, title: row.title, url: row.project_url, technologies: row.technologies.slice(0, 12), bullets };
        })
    : [];

  const additional = prefs.includeAdditional
    ? ai.additional
        .filter((a) => clean(a.heading) && a.items.some((x) => clean(x)))
        .slice(0, 4)
        .map((a, i) => {
          const items = a.items.map(clean).filter(Boolean).slice(0, 8);
          items.forEach((it) => flagFigures(it, "additional", `add_${i + 1}`));
          return { id: `add_${i + 1}`, heading: clean(a.heading).slice(0, 80), items };
        })
    : [];

  const summary = clean(ai.summary).slice(0, 3000);
  flagFigures(summary, "summary", null);

  // Section order: AI suggestion, made complete and valid.
  const order: SectionKey[] = [];
  for (const k of [...ai.section_order, ...DEFAULT_SECTION_ORDER]) {
    if ((SECTION_KEYS as readonly string[]).includes(k) && !order.includes(k)) order.push(k);
  }

  return {
    version: 1,
    contact: contactFromProfile(bundle, clean(ai.headline).slice(0, 200)),
    summary,
    skills: skills.slice(0, 24),
    experience,
    education,
    certifications,
    projects,
    additional,
    section_order: order,
    hidden_sections: [
      ...(certifications.length ? [] : (["certifications"] as SectionKey[])),
      ...(projects.length ? [] : (["projects"] as SectionKey[])),
      ...(additional.length ? [] : (["additional"] as SectionKey[])),
    ],
    meta: {
      application_id: params.application?.id ?? null,
      job_title: params.application?.job_title ?? null,
      company_name: params.application?.company_name ?? null,
      generated_at: new Date().toISOString(),
      model: params.model,
      skill_gaps: skillGaps.slice(0, 20),
      warnings,
      tailoring_notes: ai.tailoring_notes.slice(0, 8),
      preferences: prefs,
    },
  };
}

/** A resume built directly from the profile, without AI (manual starting point). */
export function resumeFromProfile(bundle: CandidateBundle, application: { id: string; job_title: string; company_name: string } | null): ResumeContent {
  const ai: ResumeAiOutput = {
    headline: bundle.candidate.professional_title ?? "",
    summary: bundle.candidate.professional_summary ?? "",
    core_skills: bundle.skills.map((s) => s.skill_name),
    experience: [],
    education: [],
    certifications: [],
    projects: bundle.projects.map((_, i) => ({ ref: `proj_${i + 1}`, bullets: [] })),
    additional: [],
    section_order: DEFAULT_SECTION_ORDER,
    skill_gaps: [],
    tailoring_notes: [],
  };
  const refs: Refs = {
    experiences: new Map(),
    education: new Map(),
    certifications: new Map(),
    projects: new Map(bundle.projects.map((p, i) => [`proj_${i + 1}`, p.id])),
    extras: new Map(),
  };
  const content = assembleResume({
    ai,
    bundle,
    refs,
    prefs: { length: "two_pages", emphasis: "", includeProjects: true, includeCertifications: true, includeAdditional: false },
    application,
    model: "manual",
  });
  content.projects = content.projects.map((p) => {
    const row = bundle.projects.find((r) => r.id === p.source_id);
    return { ...p, bullets: row?.description ? [row.description.slice(0, 600)] : [] };
  });
  content.meta = { ...content.meta, warnings: [], skill_gaps: [], model: "manual" };
  return content;
}

import type { CandidateBundle } from "@/lib/db/types";
import { formatMonthYear } from "@/lib/utils";

/**
 * Factual-integrity safeguards applied to AI output.
 *
 * The prompt forbids invention, but we never rely on the prompt alone:
 *  - skills the AI lists must be evidenced somewhere in the verified profile;
 *  - numbers/figures in generated text must appear in the profile, otherwise
 *    the sentence is flagged for the user to verify.
 */

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", fifty: "50", hundred: "100",
};

export function normaliseForMatch(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+#.%$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

export interface EvidenceCorpus {
  text: string;
  skillNames: Set<string>;
  figures: Set<string>;
}

/** Everything the candidate has verified, flattened for matching. */
export function buildEvidenceCorpus(bundle: Pick<CandidateBundle, "profile" | "candidate" | "experiences" | "education" | "skills" | "certifications" | "projects" | "extras">): EvidenceCorpus {
  const c = bundle.candidate;
  const chunks: string[] = [
    bundle.profile.full_name,
    c.professional_title ?? "",
    c.professional_summary ?? "",
    c.current_occupation ?? "",
    c.years_experience !== null && c.years_experience !== undefined ? `${c.years_experience} years` : "",
  ];
  const skillNames = new Set<string>();
  for (const s of bundle.skills) {
    chunks.push(s.skill_name);
    skillNames.add(normaliseForMatch(s.skill_name).trim());
  }
  for (const e of bundle.experiences) {
    chunks.push(e.job_title, e.company, e.location ?? "", e.responsibilities, e.achievements, ...e.technologies);
    chunks.push(formatMonthYear(e.start_date), formatMonthYear(e.end_date));
    for (const t of e.technologies) skillNames.add(normaliseForMatch(t).trim());
  }
  for (const e of bundle.education) chunks.push(e.qualification, e.field_of_study ?? "", e.institution, e.achievements, formatMonthYear(e.graduation_date));
  for (const x of bundle.certifications) {
    chunks.push(x.name, x.institution ?? "");
    skillNames.add(normaliseForMatch(x.name).trim());
  }
  for (const p of bundle.projects) {
    chunks.push(p.title, p.role ?? "", p.description, ...p.technologies);
    for (const t of p.technologies) skillNames.add(normaliseForMatch(t).trim());
  }
  for (const x of bundle.extras) chunks.push(x.title, x.organisation ?? "", x.description);

  const text = normaliseForMatch(chunks.join(" \n "));
  return { text, skillNames, figures: new Set(extractFigures(chunks.join(" "))) };
}

/** True when the skill is named in the profile (skills, technologies, certifications or text). */
export function isSkillEvidenced(skill: string, corpus: EvidenceCorpus): boolean {
  const n = normaliseForMatch(skill).trim();
  if (!n) return false;
  if (corpus.skillNames.has(n)) return true;
  // Whole-phrase match in the verified text.
  if (corpus.text.includes(` ${n} `)) return true;
  // Tolerate simple variants: "JavaScript (ES6+)" vs "JavaScript", trailing "s".
  const base = n.replace(/\s*\(.*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (base && base !== n && (corpus.skillNames.has(base) || corpus.text.includes(` ${base} `))) return true;
  if (n.endsWith("s") && corpus.text.includes(` ${n.slice(0, -1)} `)) return true;
  return false;
}

/**
 * Pull out numeric claims ("40%", "$2.5m", "120", "3x", "two") normalised to
 * a comparable form.
 */
export function extractFigures(text: string): string[] {
  const out: string[] = [];
  const lower = text.toLowerCase();
  const re = /(?:[$€£]|nz\$|au\$|us\$)?\s?\d[\d,]*(?:\.\d+)?\s?(?:%|k\b|m\b|bn\b|x\b|\+)?/g;
  for (const match of lower.matchAll(re)) {
    const raw = match[0].replace(/\s+/g, "");
    const digits = raw.replace(/[^\d.%kmbnx+]/g, "").replace(/,/g, "");
    const value = digits.replace(/^0+(?=\d)/, "");
    if (!value) continue;
    out.push(value);
    // Also record the bare number so "40%" in output matches "40 per cent" etc.
    const bare = value.replace(/[%kmbnx+]+$/, "");
    if (bare && bare !== value) out.push(bare);
  }
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) out.push(digit);
  }
  return out;
}

/** Figures in `generated` that cannot be found in the candidate's profile. */
export function unverifiedFigures(generated: string, corpus: EvidenceCorpus): string[] {
  const found = new Set<string>();
  for (const fig of extractFigures(generated)) {
    const bare = fig.replace(/[%kmbnx+]+$/, "");
    // Years and single digits that already appear in the profile are fine.
    if (corpus.figures.has(fig) || corpus.figures.has(bare)) continue;
    found.add(fig);
  }
  // Report the original-looking figures (dedupe bare duplicates of suffixed ones).
  return [...found].filter((f) => ![...found].some((g) => g !== f && g.startsWith(f) && /[%kmbnx+]$/.test(g)));
}

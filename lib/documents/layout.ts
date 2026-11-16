import { SECTION_HEADINGS, type ResumeContent } from "@/lib/resume/types";
import { formatDateRange, formatMonthYear } from "@/lib/utils";

/**
 * Renderer-agnostic document model shared by DOCX and PDF output so both
 * formats have the same single-column, ATS-friendly structure.
 */
export type DocBlock =
  | { type: "name"; text: string }
  | { type: "headline"; text: string }
  | { type: "contact"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "entry"; title: string; subtitle: string; dates: string }
  | { type: "bullet"; text: string }
  | { type: "spacer" };

export function resumeBlocks(c: ResumeContent): DocBlock[] {
  const blocks: DocBlock[] = [];
  blocks.push({ type: "name", text: c.contact.full_name || "Your Name" });
  if (c.contact.headline) blocks.push({ type: "headline", text: c.contact.headline });
  const contact = [c.contact.location, c.contact.phone, c.contact.email, ...c.contact.links.map((l) => l.url.replace(/^https?:\/\//, "").replace(/\/$/, ""))]
    .filter(Boolean)
    .join("  |  ");
  if (contact) blocks.push({ type: "contact", text: contact });

  for (const key of c.section_order) {
    if (c.hidden_sections.includes(key)) continue;
    switch (key) {
      case "summary":
        if (!c.summary.trim()) break;
        blocks.push({ type: "heading", text: SECTION_HEADINGS.summary }, { type: "paragraph", text: c.summary.trim() });
        break;
      case "skills":
        if (!c.skills.length) break;
        // Non-breaking space keeps each separator attached to the preceding skill when wrapping.
        blocks.push({ type: "heading", text: SECTION_HEADINGS.skills }, { type: "paragraph", text: c.skills.join("\u00a0• ") });
        break;
      case "experience":
        if (!c.experience.length) break;
        blocks.push({ type: "heading", text: SECTION_HEADINGS.experience });
        for (const e of c.experience) {
          blocks.push({
            type: "entry",
            title: e.job_title,
            subtitle: [e.company, e.location].filter(Boolean).join(", "),
            dates: formatDateRange(e.start_date, e.end_date, e.is_current),
          });
          for (const b of e.bullets) if (b.trim()) blocks.push({ type: "bullet", text: b.trim() });
        }
        break;
      case "education":
        if (!c.education.length) break;
        blocks.push({ type: "heading", text: SECTION_HEADINGS.education });
        for (const e of c.education) {
          blocks.push({
            type: "entry",
            title: [e.qualification, e.field_of_study].filter(Boolean).join(", "),
            subtitle: e.institution,
            dates: e.end_date ? formatMonthYear(e.end_date) : formatDateRange(e.start_date, null),
          });
          for (const d of e.details) if (d.trim()) blocks.push({ type: "bullet", text: d.trim() });
        }
        break;
      case "certifications":
        if (!c.certifications.length) break;
        blocks.push({ type: "heading", text: SECTION_HEADINGS.certifications });
        for (const x of c.certifications) {
          blocks.push({ type: "bullet", text: [x.name, x.issuer, x.date ? formatMonthYear(x.date) : ""].filter(Boolean).join(" — ") });
        }
        break;
      case "projects":
        if (!c.projects.length) break;
        blocks.push({ type: "heading", text: SECTION_HEADINGS.projects });
        for (const p of c.projects) {
          blocks.push({
            type: "entry",
            title: p.title,
            subtitle: [p.technologies.length ? p.technologies.join(", ") : "", p.url ? p.url.replace(/^https?:\/\//, "") : ""].filter(Boolean).join("  |  "),
            dates: "",
          });
          for (const b of p.bullets) if (b.trim()) blocks.push({ type: "bullet", text: b.trim() });
        }
        break;
      case "additional":
        for (const a of c.additional) {
          if (!a.items.length) continue;
          blocks.push({ type: "heading", text: a.heading });
          for (const i of a.items) if (i.trim()) blocks.push({ type: "bullet", text: i.trim() });
        }
        break;
    }
  }
  return blocks;
}

export interface LetterHeader {
  fullName: string;
  contact: string;
  date: string;
  recipient: string[];
}

export function coverLetterParagraphs(content: string): string[] {
  return content
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

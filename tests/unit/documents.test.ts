import { describe, expect, it } from "vitest";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { buildCandidateContext } from "@/lib/ai/prompts";
import { renderCoverLetterDocx, renderResumeDocx } from "@/lib/documents/docx";
import { renderCoverLetterPdf, renderResumePdf } from "@/lib/documents/pdf";
import { assembleResume } from "@/lib/resume/assemble";
import { sampleBundle } from "../support/bundle";

const bundle = sampleBundle();
const { refs } = buildCandidateContext(bundle);
const longBullets = Array.from({ length: 12 }, (_, i) => `Delivered accessible WordPress feature number ${i + 1} for a government client, working closely with designers and stakeholders to meet WCAG 2.1 AA requirements`);
const content = assembleResume({
  ai: {
    headline: "Senior Web Developer | WordPress & Accessibility",
    summary: "Senior web developer with 7 years of experience building accessible WordPress sites.",
    core_skills: ["WordPress", "PHP", "JavaScript", "Accessibility (WCAG 2.1)"],
    experience: [{ ref: "exp_1", bullets: longBullets }, { ref: "exp_2", bullets: ["Built custom WordPress themes and plugins"] }],
    education: [{ ref: "edu_1", details: [] }],
    certifications: [{ ref: "cert_1" }],
    projects: [{ ref: "proj_1", bullets: ["Built a React app for practising te reo Māori vocabulary"] }],
    additional: [],
    section_order: ["summary", "skills", "experience", "education", "certifications", "projects", "additional"],
    skill_gaps: [],
    tailoring_notes: [],
  },
  bundle,
  refs,
  prefs: { length: "two_pages", emphasis: "", includeProjects: true, includeCertifications: true, includeAdditional: true },
  application: { id: "a", job_title: "Senior Web Developer", company_name: "Harbour & Co" },
  model: "test",
});

async function pdfText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return { text: text.replace(/\s+/g, " "), pages: pdf.numPages };
}

describe("resume PDF", () => {
  it("is machine-readable text with standard headings and Unicode names", async () => {
    const bytes = await renderResumePdf(content, "Resume – Senior Web Developer");
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const { text, pages } = await pdfText(bytes);
    for (const expected of ["Aroha Ngata", "PROFESSIONAL SUMMARY", "CORE SKILLS", "PROFESSIONAL EXPERIENCE", "EDUCATION", "Kōwhai Digital", "Tūī Interactive", "te reo Māori", "Mar 2020 – Present"]) {
      expect(text).toContain(expected);
    }
    expect(pages).toBe(1);
  });

  it("flows long content onto additional pages", async () => {
    const long = {
      ...content,
      experience: Array.from({ length: 6 }, (_, i) => ({ ...content.experience[0]!, id: `exp_${i}`, bullets: longBullets.slice(0, 8) })),
    };
    const { text, pages } = await pdfText(await renderResumePdf(long, "Resume"));
    expect(pages).toBeGreaterThanOrEqual(3);
    // Nothing lost across page breaks.
    expect(text.match(/feature number 8 for/g)?.length).toBe(6);
  });
});

describe("resume DOCX", () => {
  it("contains the same readable content", async () => {
    const buffer = await renderResumeDocx(content, "Resume");
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    const { value } = await mammoth.extractRawText({ buffer });
    for (const expected of ["Aroha Ngata", "PROFESSIONAL EXPERIENCE", "Kōwhai Digital", "Bachelor of Information Technology", "Google Analytics Certification"]) {
      expect(value).toContain(expected);
    }
    // No tables, text boxes or header/footer parts (ATS-friendly structure).
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).not.toContain("<w:tbl>");
    expect(xml).not.toContain("<w:txbxContent>");
    expect(Object.keys(zip.files).some((f) => /word\/(header|footer)\d*\.xml/.test(f))).toBe(false);
  });
});

describe("cover letter documents", () => {
  const letter = "Dear Hiring Manager,\n\nFirst paragraph about Kōwhai Digital.\n\nSecond paragraph.\n\nKind regards,\nAroha Ngata";
  const header = { fullName: "Aroha Ngata", contact: "Wellington | aroha@example.com", date: "15 November 2026", recipient: ["Harbour & Co"] };

  it("renders PDF and DOCX with the letter text", async () => {
    const pdf = await pdfText(await renderCoverLetterPdf(letter, header, "Cover letter"));
    expect(pdf.text).toContain("Dear Hiring Manager,");
    expect(pdf.text).toContain("Kōwhai Digital");
    const { value } = await mammoth.extractRawText({ buffer: await renderCoverLetterDocx(letter, header, "Cover letter") });
    expect(value).toContain("Harbour & Co");
    expect(value).toContain("Kind regards,");
  });
});

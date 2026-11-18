import { describe, expect, it } from "vitest";
import mammoth from "mammoth";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { buildCandidateContext } from "@/lib/ai/prompts";
import { renderCoverLetterDocx, renderResumeDocx } from "@/lib/documents/docx";
import { renderCoverLetterPdf, renderResumePdf } from "@/lib/documents/pdf";
import { ACCENT_HEX, DOCX_FONT, RESUME_TEMPLATES, resolveStyle, TEMPLATE_SPECS } from "@/lib/documents/templates";
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

/** BaseFont names of the fonts embedded in a PDF. */
async function pdfFontNames(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const names: string[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || obj.get(PDFName.of("Type")) !== PDFName.of("Font")) continue;
    const base = obj.get(PDFName.of("BaseFont"));
    if (base instanceof PDFName && obj.get(PDFName.of("Subtype")) === PDFName.of("Type0")) names.push(base.decodeText());
  }
  return names;
}

/** word/document.xml from a DOCX (zip) buffer. */
async function docxXml(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  return (await zip.file("word/document.xml")!.async("string")) + (await zip.file("word/styles.xml")!.async("string"));
}

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

describe("resume templates", () => {
  const styled = (template: (typeof RESUME_TEMPLATES)[number], accent?: "navy" | "burgundy") => ({ ...content, style: { template, ...(accent ? { accent } : {}) } });

  for (const template of RESUME_TEMPLATES) {
    it(`${template}: PDF keeps whole-word, machine-readable headings and every entry`, async () => {
      const { text, pages } = await pdfText(await renderResumePdf(styled(template), "Resume"));
      const heading = (h: string) => (TEMPLATE_SPECS[template].heading.uppercase ? h.toUpperCase() : h);
      // Letter-spaced headings must still extract as words (ATS parsing).
      for (const h of ["Professional Summary", "Core Skills", "Professional Experience", "Education"]) expect(text).toContain(heading(h));
      for (const expected of ["Aroha Ngata", "Kōwhai Digital", "Tūī Interactive", "te reo Māori", "Mar 2020 – Present"]) expect(text).toContain(expected);
      expect(pages).toBeLessThanOrEqual(2);
    });

    it(`${template}: DOCX uses the template's font and keeps the content`, async () => {
      const buffer = await renderResumeDocx(styled(template, "burgundy"), "Resume");
      const { value } = await mammoth.extractRawText({ buffer });
      expect(value).toContain("Kōwhai Digital");
      const xml = await docxXml(buffer);
      expect(xml).toContain(DOCX_FONT[TEMPLATE_SPECS[template].font]);
      expect(xml).toContain(ACCENT_HEX.burgundy.slice(1));
    });
  }

  it("embeds the serif font for Executive and the sans font otherwise", async () => {
    const executive = await pdfFontNames(await renderResumePdf(styled("executive"), "Resume"));
    const classic = await pdfFontNames(await renderResumePdf(content, "Resume"));
    expect(executive.every((f) => f.includes("LiberationSerif"))).toBe(true);
    expect(classic.every((f) => f.includes("LiberationSans"))).toBe(true);
    expect(classic.length).toBeGreaterThan(0);
  });

  it("keeps heading letter-spacing narrow enough for ATS text extraction", () => {
    for (const t of RESUME_TEMPLATES) {
      const { heading, size } = TEMPLATE_SPECS[t];
      expect(heading.tracking, t).toBeLessThanOrEqual(size.heading * 0.06);
    }
  });

  it("Compact fits more on a page than Executive", async () => {
    const long = { ...content, experience: Array.from({ length: 8 }, (_, i) => ({ ...content.experience[0]!, id: `exp_${i}`, bullets: longBullets.slice(0, 8) })) };
    const compact = await pdfText(await renderResumePdf({ ...long, style: { template: "compact" } }, "Resume"));
    const executive = await pdfText(await renderResumePdf({ ...long, style: { template: "executive" } }, "Resume"));
    expect(compact.pages).toBeLessThan(executive.pages);
  });

  it("falls back to Classic with its default colour for resumes saved before styles existed", () => {
    expect(resolveStyle(undefined)).toMatchObject({ template: "classic", accent: "charcoal" });
    expect(resolveStyle({ template: "modern" })).toMatchObject({ template: "modern", accent: "teal" });
    expect(resolveStyle({ template: "nope" as never, accent: "nope" as never })).toMatchObject({ template: "classic", accent: "charcoal" });
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

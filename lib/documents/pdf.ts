import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, setCharacterSpacing, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { ResumeContent } from "@/lib/resume/types";
import { coverLetterParagraphs, resumeBlocks, type LetterHeader } from "./layout";
import { MUTED_HEX, resolveStyle, RULE_HEX, SUBTLE_HEX, type ResumeStyle, type TemplateSpec } from "./templates";

// A4 in points. Margins, sizes and spacing come from the template spec.
const A4 = { width: 595.28, height: 841.89 };

function hexToRgb(hex: string): RGB {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const INK = rgb(0.067, 0.094, 0.153);
const MUTED = hexToRgb(MUTED_HEX);
const SUBTLE = hexToRgb(SUBTLE_HEX);
const RULE = hexToRgb(RULE_HEX);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

// Disable OpenType ligatures/contextual alternates: layout widths are computed
// per character, and substituted ligature glyphs (e.g. "ti") otherwise cause
// visible gaps and can be dropped from font subsets.
const NO_LIGATURES = { liga: false, clig: false, dlig: false, calt: false, rlig: false };

type FontFamily = TemplateSpec["font"];
const FONT_FILES: Record<FontFamily, string> = { sans: "LiberationSans", serif: "LiberationSerif" };
const fontBytes = new Map<FontFamily, { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array }>();

async function loadFontBytes(family: FontFamily) {
  let bytes = fontBytes.get(family);
  if (!bytes) {
    const dir = path.join(process.cwd(), "lib", "documents", "fonts");
    const base = FONT_FILES[family];
    const [regular, bold, italic] = await Promise.all([
      fs.readFile(path.join(dir, `${base}-Regular.ttf`)),
      fs.readFile(path.join(dir, `${base}-Bold.ttf`)),
      fs.readFile(path.join(dir, `${base}-Italic.ttf`)),
    ]);
    bytes = { regular, bold, italic };
    fontBytes.set(family, bytes);
  }
  return bytes;
}

/** Remove characters that can't be laid out (control chars) and normalise spaces. */
function sanitise(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replace(/\t/g, " ");
}

/**
 * Minimal text layout engine on top of pdf-lib: word wrapping, page breaks,
 * hanging-indent bullets and right-aligned dates. Text is real, selectable
 * text with an embedded (subset) font, so it remains machine-readable.
 */
class PdfWriter {
  page!: PDFPage;
  y = 0;
  readonly margin: number;
  readonly width: number;

  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts,
    readonly spec: TemplateSpec,
    readonly accent: RGB,
    margin: number = spec.margin,
  ) {
    this.margin = margin;
    this.width = A4.width - margin * 2;
    this.newPage();
  }

  /** Full-width horizontal rule. */
  rule(color: RGB, thickness: number, before = 4, after = 10) {
    this.y -= before;
    this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: A4.width - this.margin, y: this.y }, thickness, color });
    this.y -= after;
  }

  newPage() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - this.margin;
  }

  ensure(height: number) {
    if (this.y - height < this.margin) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const rawLine of sanitise(text).split("\n")) {
      // Split on ordinary spaces only so non-breaking spaces keep words together.
      const words = rawLine.split(/[ \t]+/).filter(Boolean);
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        // Break very long words (URLs) by characters.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
              lines.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else line = word;
      }
      lines.push(line);
    }
    return lines;
  }

  text(
    text: string,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: RGB;
      indent?: number;
      lineGap?: number;
      before?: number;
      after?: number;
      keepWith?: number;
      align?: "left" | "center";
    } = {},
  ) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? this.spec.size.body;
    const lineHeight = size * this.spec.spacing.line + (opts.lineGap ?? 0);
    const indent = opts.indent ?? 0;
    const lines = this.wrap(text, font, size, this.width - indent);
    this.y -= opts.before ?? 0;
    this.ensure(lineHeight * Math.min(lines.length, 2) + (opts.keepWith ?? 0));
    for (const line of lines) {
      this.ensure(lineHeight);
      this.y -= size;
      const x = opts.align === "center" ? this.margin + (this.width - font.widthOfTextAtSize(line, size)) / 2 : this.margin + indent;
      this.page.drawText(line, { x, y: this.y, size, font, color: opts.color ?? INK });
      this.y -= lineHeight - size;
    }
    this.y -= opts.after ?? 0;
  }

  heading(text: string) {
    const { heading, size: sizes, spacing } = this.spec;
    const size = sizes.heading;
    const label = heading.uppercase ? sanitise(text).toUpperCase() : sanitise(text);
    this.y -= spacing.section;
    this.ensure(size + 40);
    this.y -= size;
    // Letter spacing uses the PDF character-spacing operator (Tc), so text
    // extraction (and ATS parsing) still sees whole words.
    if (heading.tracking) this.page.pushOperators(setCharacterSpacing(heading.tracking));
    this.page.drawText(label, { x: this.margin, y: this.y, size, font: this.fonts.bold, color: this.accent });
    if (heading.tracking) this.page.pushOperators(setCharacterSpacing(0));
    this.y -= 4;
    if (heading.rule !== "none") {
      this.page.drawLine({
        start: { x: this.margin, y: this.y },
        end: { x: A4.width - this.margin, y: this.y },
        thickness: heading.ruleWeight,
        color: heading.rule === "accent" ? this.accent : RULE,
      });
    }
    this.y -= 7;
  }

  entry(title: string, subtitle: string, dates: string) {
    const size = this.spec.size.body;
    const datesWidth = dates ? this.fonts.regular.widthOfTextAtSize(sanitise(dates), size) : 0;
    const titleLines = this.wrap(title, this.fonts.bold, size, this.width - datesWidth - 12);
    this.y -= this.spec.spacing.entry;
    this.ensure(size * this.spec.spacing.line * (titleLines.length + (subtitle ? 1 : 0)) + 26);
    titleLines.forEach((line, i) => {
      this.y -= size;
      this.page.drawText(line, { x: this.margin, y: this.y, size, font: this.fonts.bold, color: INK });
      if (i === 0 && dates) {
        this.page.drawText(sanitise(dates), { x: A4.width - this.margin - datesWidth, y: this.y, size, font: this.fonts.regular, color: MUTED });
      }
      this.y -= size * (this.spec.spacing.line - 1);
    });
    if (subtitle) this.text(subtitle, { font: this.spec.subtitleItalic ? this.fonts.italic : this.fonts.regular, size, color: SUBTLE, after: 1 });
  }

  bullet(text: string) {
    const size = this.spec.size.body;
    const indent = size * 1.4;
    const lines = this.wrap(text, this.fonts.regular, size, this.width - indent);
    const lineHeight = size * (this.spec.spacing.line - 0.02);
    this.ensure(lineHeight);
    lines.forEach((line, i) => {
      this.ensure(lineHeight);
      this.y -= size;
      if (i === 0) this.page.drawText("•", { x: this.margin + size * 0.4, y: this.y, size, font: this.fonts.regular, color: INK });
      this.page.drawText(line, { x: this.margin + indent, y: this.y, size, font: this.fonts.regular, color: INK });
      this.y -= lineHeight - size;
    });
    this.y -= this.spec.spacing.bullet;
  }
}

async function createDoc(meta: { title: string; author: string }, spec: TemplateSpec, accentHex: string, margin?: number) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = await loadFontBytes(spec.font);
  const fonts: Fonts = {
    regular: await doc.embedFont(bytes.regular, { subset: true, features: NO_LIGATURES }),
    bold: await doc.embedFont(bytes.bold, { subset: true, features: NO_LIGATURES }),
    italic: await doc.embedFont(bytes.italic, { subset: true, features: NO_LIGATURES }),
  };
  doc.setTitle(meta.title, { showInWindowTitleBar: true });
  doc.setAuthor(meta.author);
  doc.setCreator("ApplyDesk");
  doc.setProducer("ApplyDesk");
  doc.setLanguage("en");
  return { doc, writer: new PdfWriter(doc, fonts, spec, hexToRgb(accentHex), margin), fonts };
}

export async function renderResumePdf(content: ResumeContent, title: string): Promise<Uint8Array> {
  const style = resolveStyle(content.style);
  const { spec } = style;
  const { doc, writer, fonts } = await createDoc({ title, author: content.contact.full_name }, spec, style.accentHex);
  const align = spec.headerAlign;
  for (const b of resumeBlocks(content)) {
    switch (b.type) {
      case "name":
        writer.text(b.text, { font: fonts.bold, size: spec.size.name, color: writer.accent, after: 2, align });
        break;
      case "headline":
        writer.text(b.text, { size: spec.size.headline, color: SUBTLE, after: 1, align });
        break;
      case "contact":
        writer.text(b.text, { size: spec.size.contact, color: MUTED, after: 4, align });
        break;
      case "heading":
        writer.heading(b.text);
        break;
      case "paragraph":
        writer.text(b.text, { after: 2, lineGap: 0.5 });
        break;
      case "entry":
        writer.entry(b.title, b.subtitle, b.dates);
        break;
      case "bullet":
        writer.bullet(b.text);
        break;
      case "spacer":
        writer.y -= 8;
        break;
    }
  }
  return doc.save();
}

export async function renderCoverLetterPdf(content: string, header: LetterHeader, title: string, style?: ResumeStyle): Promise<Uint8Array> {
  const { spec, accentHex } = resolveStyle(style);
  const letter = spec.letter;
  const { doc, writer, fonts } = await createDoc({ title, author: header.fullName }, spec, accentHex, letter.margin);
  const align = spec.headerAlign;
  const body = letter.bodySize;
  writer.text(header.fullName, { font: fonts.bold, size: letter.nameSize, color: writer.accent, after: 2, align });
  if (header.contact) writer.text(header.contact, { size: spec.size.contact, color: MUTED, align });
  if (letter.headerRule !== "none") writer.rule(letter.headerRule === "accent" ? writer.accent : RULE, letter.headerRule === "accent" ? 1.2 : 0.6, 8, 16);
  else writer.y -= 18;
  writer.text(header.date, { size: body, after: 12 });
  for (const line of header.recipient) writer.text(line, { size: body });
  if (header.recipient.length) writer.y -= 12;
  for (const para of coverLetterParagraphs(content)) {
    writer.text(para, { size: body, lineGap: 1.5, after: letter.paragraphGap });
  }
  return doc.save();
}

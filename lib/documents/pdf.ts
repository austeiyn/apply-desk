import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { ResumeContent } from "@/lib/resume/types";
import { coverLetterParagraphs, resumeBlocks, type LetterHeader } from "./layout";

// A4 in points; 0.6" margins.
const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 43;
const CONTENT_WIDTH = A4.width - MARGIN * 2;
const INK = rgb(0.067, 0.094, 0.153);
const MUTED = rgb(0.294, 0.333, 0.388);
const RULE = rgb(0.612, 0.639, 0.686);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

// Disable OpenType ligatures/contextual alternates: layout widths are computed
// per character, and substituted ligature glyphs (e.g. "ti") otherwise cause
// visible gaps and can be dropped from font subsets.
const NO_LIGATURES = { liga: false, clig: false, dlig: false, calt: false, rlig: false };

let fontBytes: { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array } | null = null;

async function loadFontBytes() {
  if (!fontBytes) {
    const dir = path.join(process.cwd(), "lib", "documents", "fonts");
    const [regular, bold, italic] = await Promise.all([
      fs.readFile(path.join(dir, "LiberationSans-Regular.ttf")),
      fs.readFile(path.join(dir, "LiberationSans-Bold.ttf")),
      fs.readFile(path.join(dir, "LiberationSans-Italic.ttf")),
    ]);
    fontBytes = { regular, bold, italic };
  }
  return fontBytes;
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

  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN) this.newPage();
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
    opts: { font?: PDFFont; size?: number; color?: RGB; indent?: number; lineGap?: number; before?: number; after?: number; keepWith?: number } = {},
  ) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 10;
    const lineHeight = size * 1.28 + (opts.lineGap ?? 0);
    const indent = opts.indent ?? 0;
    const lines = this.wrap(text, font, size, CONTENT_WIDTH - indent);
    this.y -= opts.before ?? 0;
    this.ensure(lineHeight * Math.min(lines.length, 2) + (opts.keepWith ?? 0));
    for (const line of lines) {
      this.ensure(lineHeight);
      this.y -= size;
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font, color: opts.color ?? INK });
      this.y -= lineHeight - size;
    }
    this.y -= opts.after ?? 0;
  }

  heading(text: string) {
    const size = 10.5;
    this.y -= 9;
    this.ensure(size + 40);
    this.y -= size;
    this.page.drawText(sanitise(text).toUpperCase(), { x: MARGIN, y: this.y, size, font: this.fonts.bold, color: INK });
    this.y -= 4;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4.width - MARGIN, y: this.y }, thickness: 0.6, color: RULE });
    this.y -= 7;
  }

  entry(title: string, subtitle: string, dates: string) {
    const size = 10;
    const datesWidth = dates ? this.fonts.regular.widthOfTextAtSize(sanitise(dates), size) : 0;
    const titleLines = this.wrap(title, this.fonts.bold, size, CONTENT_WIDTH - datesWidth - 12);
    this.y -= 5;
    this.ensure(size * 1.28 * (titleLines.length + (subtitle ? 1 : 0)) + 26);
    titleLines.forEach((line, i) => {
      this.y -= size;
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font: this.fonts.bold, color: INK });
      if (i === 0 && dates) {
        this.page.drawText(sanitise(dates), { x: A4.width - MARGIN - datesWidth, y: this.y, size, font: this.fonts.regular, color: MUTED });
      }
      this.y -= size * 0.28;
    });
    if (subtitle) this.text(subtitle, { font: this.fonts.italic, size: 10, color: rgb(0.216, 0.255, 0.318), after: 1 });
  }

  bullet(text: string) {
    const size = 10;
    const indent = 14;
    const lines = this.wrap(text, this.fonts.regular, size, CONTENT_WIDTH - indent);
    const lineHeight = size * 1.26;
    this.ensure(lineHeight);
    lines.forEach((line, i) => {
      this.ensure(lineHeight);
      this.y -= size;
      if (i === 0) this.page.drawText("•", { x: MARGIN + 4, y: this.y, size, font: this.fonts.regular, color: INK });
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font: this.fonts.regular, color: INK });
      this.y -= lineHeight - size;
    });
    this.y -= 1.5;
  }
}

async function createDoc(meta: { title: string; author: string }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = await loadFontBytes();
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
  return { doc, writer: new PdfWriter(doc, fonts), fonts };
}

export async function renderResumePdf(content: ResumeContent, title: string): Promise<Uint8Array> {
  const { doc, writer, fonts } = await createDoc({ title, author: content.contact.full_name });
  for (const b of resumeBlocks(content)) {
    switch (b.type) {
      case "name":
        writer.text(b.text, { font: fonts.bold, size: 18, after: 2 });
        break;
      case "headline":
        writer.text(b.text, { size: 11, color: rgb(0.122, 0.161, 0.216), after: 1 });
        break;
      case "contact":
        writer.text(b.text, { size: 9.5, color: MUTED, after: 4 });
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

export async function renderCoverLetterPdf(content: string, header: LetterHeader, title: string): Promise<Uint8Array> {
  const { doc, writer, fonts } = await createDoc({ title, author: header.fullName });
  writer.text(header.fullName, { font: fonts.bold, size: 16, after: 2 });
  if (header.contact) writer.text(header.contact, { size: 9.5, color: MUTED, after: 18 });
  writer.text(header.date, { size: 10.5, after: 12 });
  for (const line of header.recipient) writer.text(line, { size: 10.5 });
  if (header.recipient.length) writer.y -= 12;
  for (const para of coverLetterParagraphs(content)) {
    writer.text(para, { size: 10.5, lineGap: 1.5, after: 10 });
  }
  return doc.save();
}

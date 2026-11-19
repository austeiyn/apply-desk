import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  type IParagraphOptions,
} from "docx";
import type { ResumeContent } from "@/lib/resume/types";
import { coverLetterParagraphs, resumeBlocks, type LetterHeader } from "./layout";
import { DOCX_FONT, INK_HEX, MUTED_HEX, resolveStyle, RULE_HEX, SUBTLE_HEX, type ResumeStyle, type TemplateSpec } from "./templates";

// A4 in twentieths of a point (twips). Margins, sizes and spacing come from
// the template spec, in points. Liberation Sans/Serif (used for PDFs) are
// metric-compatible with Arial/Times New Roman, so DOCX and PDF match.
const PAGE = { width: 11906, height: 16838 };
const hex = (h: string) => h.replace("#", "").toUpperCase();
const INK = hex(INK_HEX);
const MUTED = hex(MUTED_HEX);
const SUBTLE = hex(SUBTLE_HEX);

const pt = (n: number) => Math.round(n * 2); // docx font sizes are half-points
const tw = (n: number) => Math.round(n * 20); // spacing in twentieths of a point
const lineRule = (multiple: number) => Math.round(240 * (multiple - 0.2)); // 240 = single spacing

function baseDocument(sections: Paragraph[], meta: { title: string; author: string }, spec: TemplateSpec, marginPoints: number = spec.margin) {
  const margin = tw(marginPoints);
  return new Document({
    title: meta.title,
    creator: meta.author,
    description: "Created with ApplyDesk",
    styles: { default: { document: { run: { font: DOCX_FONT[spec.font], size: pt(spec.size.body), color: INK } } } },
    numbering: {
      config: [
        {
          reference: "ad-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 340, hanging: 220 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: margin, bottom: margin, left: margin, right: margin } } },
        children: sections,
      },
    ],
  });
}

export async function renderResumeDocx(content: ResumeContent, title: string): Promise<Buffer> {
  const { spec, accentHex } = resolveStyle(content.style);
  const accent = hex(accentHex);
  const contentWidth = PAGE.width - tw(spec.margin) * 2;
  const headerAlign = spec.headerAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const paragraphs: Paragraph[] = [];

  for (const b of resumeBlocks(content)) {
    switch (b.type) {
      case "name":
        paragraphs.push(
          new Paragraph({ alignment: headerAlign, spacing: { after: 40 }, children: [new TextRun({ text: b.text, bold: true, size: pt(spec.size.name), color: accent })] }),
        );
        break;
      case "headline":
        paragraphs.push(new Paragraph({ alignment: headerAlign, spacing: { after: 40 }, children: [new TextRun({ text: b.text, size: pt(spec.size.headline), color: SUBTLE })] }));
        break;
      case "contact":
        paragraphs.push(new Paragraph({ alignment: headerAlign, spacing: { after: 120 }, children: [new TextRun({ text: b.text, size: pt(spec.size.contact), color: MUTED })] }));
        break;
      case "heading": {
        const { heading } = spec;
        paragraphs.push(
          new Paragraph({
            spacing: { before: tw(spec.spacing.section + 2), after: 80 },
            keepNext: true,
            ...(heading.rule === "none"
              ? {}
              : {
                  border: {
                    bottom: { style: BorderStyle.SINGLE, size: Math.max(2, Math.round(heading.ruleWeight * 8)), color: heading.rule === "accent" ? accent : hex(RULE_HEX), space: 2 },
                  },
                }),
            children: [
              new TextRun({
                text: heading.uppercase ? b.text.toUpperCase() : b.text,
                bold: true,
                size: pt(spec.size.heading),
                color: accent,
                ...(heading.tracking ? { characterSpacing: tw(heading.tracking) } : {}),
              }),
            ],
          }),
        );
        break;
      }
      case "paragraph":
        paragraphs.push(new Paragraph({ spacing: { after: 60, line: lineRule(spec.spacing.line) }, children: [new TextRun({ text: b.text })] }));
        break;
      case "entry": {
        const opts: IParagraphOptions = {
          spacing: { before: tw(spec.spacing.entry), after: 20 },
          keepNext: true,
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: [new TextRun({ text: b.title, bold: true }), ...(b.dates ? [new TextRun({ text: `\t${b.dates}`, color: MUTED })] : [])],
        };
        paragraphs.push(new Paragraph(opts));
        if (b.subtitle) {
          paragraphs.push(new Paragraph({ spacing: { after: 40 }, keepNext: true, children: [new TextRun({ text: b.subtitle, italics: spec.subtitleItalic, color: SUBTLE })] }));
        }
        break;
      }
      case "bullet":
        paragraphs.push(
          new Paragraph({
            numbering: { reference: "ad-bullets", level: 0 },
            spacing: { after: tw(spec.spacing.bullet + 0.5), line: lineRule(spec.spacing.line - 0.02) },
            children: [new TextRun({ text: b.text })],
          }),
        );
        break;
      case "spacer":
        paragraphs.push(new Paragraph({ children: [] }));
        break;
    }
  }

  return Packer.toBuffer(baseDocument(paragraphs, { title, author: content.contact.full_name }, spec));
}

export async function renderCoverLetterDocx(content: string, header: LetterHeader, title: string, style?: ResumeStyle): Promise<Buffer> {
  const { spec, accentHex } = resolveStyle(style);
  const letter = spec.letter;
  const accent = hex(accentHex);
  const alignment = spec.headerAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const body = pt(letter.bodySize);
  const rule =
    letter.headerRule === "none"
      ? {}
      : { border: { bottom: { style: BorderStyle.SINGLE, size: letter.headerRule === "accent" ? 10 : 5, color: letter.headerRule === "accent" ? accent : hex(RULE_HEX), space: 6 } } };
  const paragraphs: Paragraph[] = [
    new Paragraph({ alignment, spacing: { after: 40 }, children: [new TextRun({ text: header.fullName, bold: true, size: pt(letter.nameSize), color: accent })] }),
    new Paragraph({
      alignment,
      spacing: { after: 360 },
      ...rule,
      children: header.contact ? [new TextRun({ text: header.contact, size: pt(spec.size.contact), color: MUTED })] : [],
    }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: header.date, size: body })] }),
    ...header.recipient.map((line, i, arr) => new Paragraph({ spacing: { after: i === arr.length - 1 ? 200 : 0 }, children: [new TextRun({ text: line, size: body })] })),
  ];
  for (const para of coverLetterParagraphs(content)) {
    const lines = para.split("\n");
    paragraphs.push(
      new Paragraph({
        spacing: { after: tw(letter.paragraphGap + 1), line: 276 },
        children: lines.flatMap((line, i) => (i === 0 ? [new TextRun({ text: line, size: body })] : [new TextRun({ text: line, size: body, break: 1 })])),
      }),
    );
  }
  return Packer.toBuffer(baseDocument(paragraphs, { title, author: header.fullName }, spec, letter.margin));
}

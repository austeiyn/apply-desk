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

// A4 in twentieths of a point; 0.6" margins.
const PAGE = { width: 11906, height: 16838, margin: 864 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
// Liberation Sans (used for PDFs) is metric-compatible with Arial, so DOCX and PDF match.
const FONT = "Arial";
const INK = "111827";
const MUTED = "4B5563";

const pt = (n: number) => Math.round(n * 2); // docx sizes are half-points

function baseDocument(sections: Paragraph[], meta: { title: string; author: string }) {
  return new Document({
    title: meta.title,
    creator: meta.author,
    description: "Created with ApplyDesk",
    styles: { default: { document: { run: { font: FONT, size: pt(10), color: INK } } } },
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
        properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin } } },
        children: sections,
      },
    ],
  });
}

export async function renderResumeDocx(content: ResumeContent, title: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  const blocks = resumeBlocks(content);

  for (const b of blocks) {
    switch (b.type) {
      case "name":
        paragraphs.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: b.text, bold: true, size: pt(18) })] }));
        break;
      case "headline":
        paragraphs.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: b.text, size: pt(11), color: "1F2937" })] }));
        break;
      case "contact":
        paragraphs.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: b.text, size: pt(9.5), color: MUTED })] }));
        break;
      case "heading":
        paragraphs.push(
          new Paragraph({
            spacing: { before: 200, after: 80 },
            keepNext: true,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "9CA3AF", space: 2 } },
            children: [new TextRun({ text: b.text.toUpperCase(), bold: true, size: pt(10.5), characterSpacing: 10 })],
          }),
        );
        break;
      case "paragraph":
        paragraphs.push(new Paragraph({ spacing: { after: 60, line: 264 }, children: [new TextRun({ text: b.text })] }));
        break;
      case "entry": {
        const opts: IParagraphOptions = {
          spacing: { before: 100, after: 20 },
          keepNext: true,
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
          children: [new TextRun({ text: b.title, bold: true }), ...(b.dates ? [new TextRun({ text: `\t${b.dates}`, color: MUTED })] : [])],
        };
        paragraphs.push(new Paragraph(opts));
        if (b.subtitle) {
          paragraphs.push(new Paragraph({ spacing: { after: 40 }, keepNext: true, children: [new TextRun({ text: b.subtitle, italics: true, color: "374151" })] }));
        }
        break;
      }
      case "bullet":
        paragraphs.push(new Paragraph({ numbering: { reference: "ad-bullets", level: 0 }, spacing: { after: 30, line: 259 }, children: [new TextRun({ text: b.text })] }));
        break;
      case "spacer":
        paragraphs.push(new Paragraph({ children: [] }));
        break;
    }
  }

  return Packer.toBuffer(baseDocument(paragraphs, { title, author: content.contact.full_name }));
}

export async function renderCoverLetterDocx(content: string, header: LetterHeader, title: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: header.fullName, bold: true, size: pt(16) })] }),
    ...(header.contact ? [new Paragraph({ spacing: { after: 280 }, children: [new TextRun({ text: header.contact, size: pt(9.5), color: MUTED })] })] : []),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: header.date })] }),
    ...header.recipient.map((line, i, arr) => new Paragraph({ spacing: { after: i === arr.length - 1 ? 200 : 0 }, children: [new TextRun({ text: line })] })),
  ];
  for (const para of coverLetterParagraphs(content)) {
    const lines = para.split("\n");
    paragraphs.push(
      new Paragraph({
        spacing: { after: 180, line: 276 },
        children: lines.flatMap((line, i) => (i === 0 ? [new TextRun({ text: line })] : [new TextRun({ text: line, break: 1 })])),
      }),
    );
  }
  return Packer.toBuffer(baseDocument(paragraphs, { title, author: header.fullName }));
}

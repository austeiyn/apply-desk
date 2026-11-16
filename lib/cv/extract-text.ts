import "server-only";

import { CV_MAX_BYTES, CV_MIME_TYPES, type CvMimeType } from "@/lib/constants";

export class CvFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CvFileError";
  }
}

/** Detect the real file type from magic bytes (never trust the client's MIME type). */
export function detectCvType(bytes: Uint8Array): CvMimeType | null {
  // %PDF-
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf";
  }
  // DOCX is a ZIP container ("PK\x03\x04") holding word/document.xml.
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));
    if (head.includes("word/") || head.includes("[Content_Types].xml")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
  }
  return null;
}

/** Normalise whitespace and strip control characters from extracted text. */
export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[   ]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MAX_TEXT_CHARS = 200_000;

/**
 * Validate a CV file and extract its text. Throws CvFileError with a
 * user-facing message for invalid, unsupported or unreadable files.
 */
export async function extractCvText(bytes: Uint8Array): Promise<{ text: string; mimeType: CvMimeType }> {
  if (bytes.byteLength === 0) throw new CvFileError("The file is empty.");
  if (bytes.byteLength > CV_MAX_BYTES) throw new CvFileError("The file is larger than 10 MB.");

  const mimeType = detectCvType(bytes);
  if (!mimeType) throw new CvFileError("Only PDF and Word (.docx) files are supported.");

  let raw = "";
  try {
    if (mimeType === "application/pdf") {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      if (pdf.numPages > 20) throw new CvFileError("That PDF has more than 20 pages. Upload your CV only.");
      const result = await extractText(pdf, { mergePages: true });
      raw = result.text;
    } else {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      raw = result.value;
    }
  } catch (error) {
    if (error instanceof CvFileError) throw error;
    console.error("[cv] text extraction failed", error);
    throw new CvFileError(
      mimeType === "application/pdf"
        ? "We couldn't read this PDF. It may be password-protected or damaged."
        : "We couldn't read this Word document. Try saving it again as .docx or upload a PDF.",
    );
  }

  const text = cleanExtractedText(raw).slice(0, MAX_TEXT_CHARS);
  if (text.replace(/\s/g, "").length < 50) {
    throw new CvFileError(
      "We couldn't find readable text in this file. It may be a scanned image. Upload a text-based PDF or Word document instead.",
    );
  }
  void CV_MIME_TYPES;
  return { text, mimeType };
}

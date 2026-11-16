import "server-only";

const TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type DocFormat = keyof typeof TYPES;

export function parseFormat(value: string | null): DocFormat | null {
  return value === "pdf" || value === "docx" ? value : null;
}

/** File download response with an RFC 6266 filename (ASCII fallback + UTF-8). */
export function fileResponse(body: Uint8Array | Buffer, format: DocFormat, fileName: string): Response {
  const ascii = fileName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || `document.${format}`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": TYPES[format],
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

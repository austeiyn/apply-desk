import { extractJobFromHtml, type ExtractedJob } from "./extract";

/**
 * A job advertisement sent from the user's own browser by the "Send to
 * ApplyDesk" bookmarklet (see components/applications/send-to-applydesk.tsx):
 * the page's URL and title, its JSON-LD blocks, and its visible text. Used
 * for sites that block automated retrieval; nothing is fetched or bypassed.
 */
export interface JobClip {
  url: string;
  title: string;
  ld: string[];
  text: string;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Rebuild a minimal HTML document from the clip and run the same extractor
 * as link imports, so both paths produce the same fields. The clip is
 * untrusted: text is escaped, and JSON-LD is only ever parsed as JSON.
 */
export function jobFromClip(clip: JobClip): ExtractedJob {
  const scripts = clip.ld
    // "</" can't appear in a JSON string unescaped; "<\/" is the same JSON.
    .map((json) => `<script type="application/ld+json">${json.replace(/<\//g, "<\\/")}</script>`)
    .join("");
  const paragraphs = clip.text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
  const html = `<!doctype html><html><head><title>${escapeHtml(clip.title)}</title>${scripts}</head><body><main>${paragraphs}</main></body></html>`;
  return extractJobFromHtml(html);
}

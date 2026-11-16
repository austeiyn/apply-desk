/**
 * Only allow same-origin relative redirects ("/dashboard/..."), never
 * protocol-relative ("//evil.com") or absolute URLs, to prevent open redirects.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://placeholder.local");
    if (url.host !== "placeholder.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

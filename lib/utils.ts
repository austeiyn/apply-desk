import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse a "YYYY-MM-DD" or "YYYY-MM" string without timezone drift. */
function parseDateParts(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: match[3] ? Number(match[3]) : 1 };
}

/** "2021-03-01" -> "Mar 2021" */
export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return "";
  const parts = parseDateParts(value);
  if (!parts || parts.m < 1 || parts.m > 12) return "";
  return `${MONTHS[parts.m - 1]} ${parts.y}`;
}

/** "2021-03-01" -> "2021-03" (value for <input type="month">) */
export function toMonthInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 7);
}

/** "2021-03" -> "2021-03-01" (DATE column), or null. */
export function fromMonthInput(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  isCurrent?: boolean,
): string {
  const s = formatMonthYear(start);
  const e = isCurrent ? "Present" : formatMonthYear(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

export function formatDate(value: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return "";
  let date: Date;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const p = parseDateParts(value)!;
    date = new Date(Date.UTC(p.y, p.m - 1, p.d));
    return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC", ...opts });
  }
  date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", ...opts });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "Never";
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(date);
}

export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function initials(fullName: string | null | undefined, fallback = "?"): string {
  if (!fullName?.trim()) return fallback;
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/** Split multi-line text into trimmed, non-empty lines (stripping bullet glyphs). */
export function toLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•●▪◦‣]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

/** Parse a comma/newline separated list into unique trimmed values. */
export function toList(text: string | null | undefined, max = 100): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n;]/)) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/** Safe filename for downloads: "Jane Doe - Resume - Acme.docx" */
export function safeFileName(parts: Array<string | null | undefined>, ext: string): string {
  const base = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.replace(/[^\p{L}\p{N} ._()-]+/gu, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" - ")
    .slice(0, 120);
  return `${base || "document"}.${ext}`;
}

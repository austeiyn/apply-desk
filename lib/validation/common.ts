import { z } from "zod";

/** Trimmed optional text: "" -> null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const requiredText = (max: number, message = "This field is required.") =>
  z.string().trim().min(1, message).max(max, `Use ${max} characters or fewer.`);

/** Long free text that is stored as '' rather than null. */
export const longText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .nullable()
    .transform((v) => v ?? "");

/** Optional http(s) URL; adds https:// if the scheme is missing. */
export const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const url = new URL(withScheme);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error();
      return url.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid web address." });
      return z.NEVER;
    }
  });

export const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!z.email().safeParse(v).success) {
      ctx.addIssue({ code: "custom", message: "Enter a valid email address." });
      return z.NEVER;
    }
    return v.toLowerCase();
  });

/** "YYYY-MM" (from <input type="month">) or "YYYY-MM-DD" -> "YYYY-MM-01"/date, "" -> null. */
export const optionalMonth = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[1]) < 1950 || Number(m[1]) > 2100) {
      ctx.addIssue({ code: "custom", message: "Enter a valid month." });
      return z.NEVER;
    }
    return `${m[1]}-${m[2]}-${m[3] ?? "01"}`;
  });

export const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return v;
  });

/** Comma/newline separated string OR string[] -> unique trimmed list. */
export const stringList = (maxItems: number, maxLen = 100) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .nullable()
    .transform((v) => {
      const raw = Array.isArray(v) ? v : (v ?? "").split(/[,\n;]/);
      const seen = new Set<string>();
      const out: string[] = [];
      for (const item of raw) {
        const t = item.trim().slice(0, maxLen);
        if (!t || seen.has(t.toLowerCase())) continue;
        seen.add(t.toLowerCase());
        out.push(t);
        if (out.length >= maxItems) break;
      }
      return out;
    });

export const uuid = z.uuid("Invalid identifier.");

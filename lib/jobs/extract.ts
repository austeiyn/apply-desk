import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

export interface ExtractedJob {
  jobTitle: string | null;
  companyName: string | null;
  location: string | null;
  employmentType: string | null;
  salaryRange: string | null;
  deadline: string | null;
  description: string;
  responsibilities: string | null;
  requiredQualifications: string | null;
  requiredSkills: string | null;
  preferredQualifications: string | null;
  source: "structured" | "page";
}

const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "header", "footer", "main", "aside", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "tr", "br", "hr", "blockquote", "pre", "dl", "dt", "dd", "figure",
]);

/** Convert an HTML fragment to readable plain text (lists become "• " lines). */
export function htmlToText(html: string): string {
  if (!html) return "";
  const $ = cheerio.load(`<div id="__root">${html}</div>`);
  $("script, style, noscript, template, svg, iframe, object, embed, form, button, input, select").remove();
  const out: string[] = [];
  const walk = (node: AnyNode) => {
    if (node.type === "text") {
      out.push((node as unknown as { data: string }).data.replace(/\s+/g, " "));
      return;
    }
    if (node.type !== "tag") return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") {
      out.push("\n");
      return;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) out.push("\n");
    if (tag === "li") out.push("• ");
    for (const child of el.children) walk(child);
    if (block) out.push("\n");
  };
  const root = $("#__root").get(0);
  if (root && "children" in root) for (const child of (root as Element).children) walk(child);
  return out
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACTOR: "Contract",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
  INTERN: "Internship",
  VOLUNTEER: "Volunteer",
  PER_DIEM: "Casual",
  OTHER: "Other",
};

type Json = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

function findJobPostings(node: unknown, out: Json[] = [], depth = 0): Json[] {
  if (depth > 8 || !node) return out;
  if (Array.isArray(node)) {
    for (const n of node) findJobPostings(n, out, depth + 1);
    return out;
  }
  if (typeof node === "object") {
    const obj = node as Json;
    const types = asArray(obj["@type"] as string | string[]).map((t) => String(t).toLowerCase());
    if (types.includes("jobposting")) out.push(obj);
    if (obj["@graph"]) findJobPostings(obj["@graph"], out, depth + 1);
    if (obj.mainEntity) findJobPostings(obj.mainEntity, out, depth + 1);
  }
  return out;
}

function formatLocation(posting: Json): string | null {
  const parts: string[] = [];
  for (const loc of asArray(posting.jobLocation as Json | Json[])) {
    const address = (loc?.address ?? loc) as Json | string;
    if (typeof address === "string") {
      parts.push(address);
      continue;
    }
    const segs = [address?.addressLocality, address?.addressRegion, typeof address?.addressCountry === "object" ? (address.addressCountry as Json)?.name : address?.addressCountry]
      .map(str)
      .filter(Boolean);
    if (segs.length) parts.push([...new Set(segs)].join(", "));
  }
  const remote = asArray(posting.jobLocationType as string | string[]).some((t) => String(t).toUpperCase() === "TELECOMMUTE");
  const text = [...new Set(parts)].slice(0, 3).join("; ");
  if (remote) return text ? `${text} (remote available)` : "Remote";
  return text || null;
}

function formatSalary(posting: Json): string | null {
  const base = posting.baseSalary as Json | undefined;
  if (!base) return str(posting.salary) ?? null;
  const currency = str(base.currency) ?? "";
  const value = (base.value ?? {}) as Json | number;
  const unit = typeof value === "object" ? str(value.unitText) : str(base.unitText);
  const fmt = (n: unknown) => {
    const num = typeof n === "number" ? n : Number(n);
    return Number.isFinite(num) ? num.toLocaleString("en-NZ") : null;
  };
  let amount: string | null = null;
  if (typeof value === "number") amount = fmt(value);
  else if (value.minValue !== undefined && value.maxValue !== undefined) amount = `${fmt(value.minValue)}–${fmt(value.maxValue)}`;
  else amount = fmt(value.value) ?? fmt(value.minValue) ?? fmt(value.maxValue);
  if (!amount) return null;
  const per = unit ? ` per ${unit.toLowerCase()}` : "";
  return `${currency ? `${currency} ` : ""}${amount}${per}`.trim();
}

function toDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function textField(v: unknown): string | null {
  if (Array.isArray(v)) {
    const items = v.map((x) => (typeof x === "string" ? htmlToText(x) : str((x as Json)?.name) ?? "")).filter(Boolean);
    return items.length ? items.map((i) => `• ${i}`).join("\n") : null;
  }
  if (typeof v === "object" && v) return str((v as Json).name) ?? str((v as Json).description);
  const s = str(v);
  return s ? htmlToText(s) : null;
}

function fromJsonLd($: cheerio.CheerioAPI): ExtractedJob | null {
  const postings: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      findJobPostings(JSON.parse(raw), postings);
    } catch {
      // Some sites emit invalid JSON-LD; try stripping trailing commas.
      try {
        findJobPostings(JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")), postings);
      } catch {
        /* ignore */
      }
    }
  });
  const p = postings[0];
  if (!p) return null;
  const org = p.hiringOrganization as Json | string | undefined;
  const description = htmlToText(str(p.description) ?? "");
  return {
    jobTitle: str(p.title),
    companyName: typeof org === "string" ? org : str(org?.name),
    location: formatLocation(p),
    employmentType:
      asArray(p.employmentType as string | string[])
        .map((t) => EMPLOYMENT_TYPE_MAP[String(t).toUpperCase().replace(/[\s-]/g, "_")] ?? String(t))
        .join(", ") || null,
    salaryRange: formatSalary(p),
    deadline: toDate(p.validThrough),
    description,
    responsibilities: textField(p.responsibilities),
    requiredQualifications: [textField(p.qualifications), textField(p.educationRequirements), textField(p.experienceRequirements)]
      .filter(Boolean)
      .join("\n") || null,
    requiredSkills: textField(p.skills),
    preferredQualifications: null,
    source: "structured",
  };
}

const CONTENT_SELECTORS = [
  '[data-automation="jobAdDetails"]',
  '[itemprop="description"]',
  "#jobDescriptionText",
  ".jobs-description__content",
  ".job-description",
  "#job-description",
  ".job-details",
  ".description",
  "article",
  "main",
  '[role="main"]',
];

function fromPage($: cheerio.CheerioAPI): ExtractedJob {
  $("script, style, noscript, template, svg, iframe, nav, header, footer, aside, form, [aria-hidden='true'], [hidden]").remove();
  let best = "";
  for (const sel of CONTENT_SELECTORS) {
    $(sel).each((_, el) => {
      const text = htmlToText($(el).html() ?? "");
      if (text.length > best.length) best = text;
    });
    if (best.length > 1500) break;
  }
  if (best.length < 300) best = htmlToText($("body").html() ?? "");

  const metaTitle = $('meta[property="og:title"]').attr("content") ?? $("title").first().text();
  const h1 = $("h1").first().text().trim();
  return {
    jobTitle: (h1 || metaTitle || "").replace(/\s+/g, " ").trim().slice(0, 300) || null,
    companyName: $('meta[property="og:site_name"]').attr("content")?.trim() || null,
    location: null,
    employmentType: null,
    salaryRange: null,
    deadline: null,
    description: best,
    responsibilities: null,
    requiredQualifications: null,
    requiredSkills: null,
    preferredQualifications: null,
    source: "page",
  };
}

/** Signals that the page is a login wall or bot challenge rather than a job ad. */
export function looksBlocked(html: string): boolean {
  const lower = html.slice(0, 200_000).toLowerCase();
  return (
    lower.includes("cf-chl") ||
    lower.includes("just a moment...") ||
    lower.includes("g-recaptcha") ||
    lower.includes("h-captcha") ||
    lower.includes("verify you are human") ||
    (lower.includes('type="password"') && /sign in|log in|login/.test(lower) && !lower.includes("jobposting"))
  );
}

const MAX_DESCRIPTION = 60_000;

export function extractJobFromHtml(html: string): ExtractedJob {
  const $ = cheerio.load(html);
  const structured = fromJsonLd($);
  const result = structured && structured.description.length >= 200 ? structured : { ...fromPage($), ...(structured ? pickNonEmpty(structured) : {}) };
  return {
    ...result,
    jobTitle: result.jobTitle?.slice(0, 300) ?? null,
    companyName: result.companyName?.slice(0, 300) ?? null,
    location: result.location?.slice(0, 300) ?? null,
    employmentType: result.employmentType?.slice(0, 100) ?? null,
    salaryRange: result.salaryRange?.slice(0, 200) ?? null,
    description: result.description.slice(0, MAX_DESCRIPTION),
    responsibilities: result.responsibilities?.slice(0, 20000) ?? null,
    requiredQualifications: result.requiredQualifications?.slice(0, 20000) ?? null,
    requiredSkills: result.requiredSkills?.slice(0, 20000) ?? null,
  };
}

function pickNonEmpty(job: ExtractedJob): Partial<ExtractedJob> {
  const out: Partial<ExtractedJob> = {};
  for (const [k, v] of Object.entries(job) as Array<[keyof ExtractedJob, ExtractedJob[keyof ExtractedJob]]>) {
    if (k === "description" || k === "source") continue;
    if (v) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

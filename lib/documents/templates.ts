/**
 * Resume styles. One spec drives the on-screen preview, the PDF and the DOCX,
 * so what the user sees is what they download. Every template is
 * single-column with real text and standard headings, so all stay
 * ATS-friendly; they differ only in typography, spacing and colour.
 *
 * Sizes and spacing are in points (1/72 inch).
 */

export const RESUME_TEMPLATES = ["classic", "modern", "executive", "compact"] as const;
export type ResumeTemplate = (typeof RESUME_TEMPLATES)[number];

export const ACCENT_COLOURS = ["charcoal", "navy", "teal", "forest", "burgundy", "plum"] as const;
export type AccentColour = (typeof ACCENT_COLOURS)[number];

/** Accent hex values. All are dark enough for body-size text on white (WCAG AA) and print well in greyscale. */
export const ACCENT_HEX: Record<AccentColour, string> = {
  charcoal: "#111827",
  navy: "#1E3A5F",
  teal: "#0F5F59",
  forest: "#1F5130",
  burgundy: "#7A1F2B",
  plum: "#4C2A6B",
};

export const ACCENT_LABELS: Record<AccentColour, string> = {
  charcoal: "Charcoal",
  navy: "Navy",
  teal: "Teal",
  forest: "Forest",
  burgundy: "Burgundy",
  plum: "Plum",
};

export interface TemplateSpec {
  label: string;
  description: string;
  font: "sans" | "serif";
  /** Alignment of the name, headline and contact line. */
  headerAlign: "left" | "center";
  /** Page margin on every side. */
  margin: number;
  size: { name: number; headline: number; contact: number; body: number; heading: number };
  heading: {
    uppercase: boolean;
    /**
     * Extra space between letters. Keep it at most 6% of the heading size:
     * wider spacing makes PDF text extraction (and many ATS parsers) read
     * headings as separate letters ("S U M M A R Y"). Enforced by a test.
     */
    tracking: number;
    /** Rule under each heading: none, a thin grey line, or a line in the accent colour. */
    rule: "none" | "grey" | "accent";
    ruleWeight: number;
  };
  /** Space before a heading, before an entry, after a bullet; line height multiple. */
  spacing: { section: number; entry: number; bullet: number; line: number };
  subtitleItalic: boolean;
  /** Accent used when the user hasn't picked one. */
  defaultAccent: AccentColour;
}

export const TEMPLATE_SPECS: Record<ResumeTemplate, TemplateSpec> = {
  classic: {
    label: "Classic",
    description: "Clean and conventional. Suits any industry.",
    font: "sans",
    headerAlign: "left",
    margin: 43,
    size: { name: 18, headline: 11, contact: 9.5, body: 10, heading: 10.5 },
    heading: { uppercase: true, tracking: 0.5, rule: "grey", ruleWeight: 0.6 },
    spacing: { section: 9, entry: 5, bullet: 1.5, line: 1.28 },
    subtitleItalic: true,
    defaultAccent: "charcoal",
  },
  modern: {
    label: "Modern",
    description: "Larger name and coloured headings with an accent rule.",
    font: "sans",
    headerAlign: "left",
    margin: 43,
    size: { name: 22, headline: 11.5, contact: 9.5, body: 10, heading: 11.5 },
    heading: { uppercase: false, tracking: 0, rule: "accent", ruleWeight: 1.2 },
    spacing: { section: 10, entry: 5, bullet: 1.5, line: 1.3 },
    subtitleItalic: false,
    defaultAccent: "teal",
  },
  executive: {
    label: "Executive",
    description: "Serif type with a centred header. Traditional and formal.",
    font: "serif",
    headerAlign: "center",
    margin: 50,
    size: { name: 21, headline: 11.5, contact: 9.5, body: 10.5, heading: 11 },
    heading: { uppercase: true, tracking: 0.6, rule: "grey", ruleWeight: 0.6 },
    spacing: { section: 11, entry: 6, bullet: 2, line: 1.28 },
    subtitleItalic: true,
    defaultAccent: "navy",
  },
  compact: {
    label: "Compact",
    description: "Tighter spacing and margins to fit more on each page.",
    font: "sans",
    headerAlign: "left",
    margin: 34,
    size: { name: 16, headline: 10, contact: 9, body: 9.5, heading: 9.5 },
    heading: { uppercase: true, tracking: 0.4, rule: "grey", ruleWeight: 0.5 },
    spacing: { section: 6, entry: 3, bullet: 0.5, line: 1.22 },
    subtitleItalic: true,
    defaultAccent: "charcoal",
  },
};

export interface ResumeStyle {
  template: ResumeTemplate;
  accent?: AccentColour;
}

export interface ResolvedStyle {
  template: ResumeTemplate;
  spec: TemplateSpec;
  accent: AccentColour;
  accentHex: string;
}

/** Fill in defaults; unknown values fall back to Classic (older resumes have no style). */
export function resolveStyle(style: Partial<ResumeStyle> | null | undefined): ResolvedStyle {
  const template = style?.template && RESUME_TEMPLATES.includes(style.template) ? style.template : "classic";
  const spec = TEMPLATE_SPECS[template];
  const accent = style?.accent && ACCENT_COLOURS.includes(style.accent) ? style.accent : spec.defaultAccent;
  return { template, spec, accent, accentHex: ACCENT_HEX[accent] };
}

/** Font stacks for the on-screen preview (metric-compatible with the PDF fonts). */
export const PREVIEW_FONT: Record<TemplateSpec["font"], string> = {
  sans: 'Arial, "Liberation Sans", Helvetica, sans-serif',
  serif: '"Times New Roman", "Liberation Serif", Times, serif',
};

/** Fonts named in DOCX files (Liberation Sans/Serif are metric-compatible with these). */
export const DOCX_FONT: Record<TemplateSpec["font"], string> = {
  sans: "Arial",
  serif: "Times New Roman",
};

/** Muted colours shared by all templates. */
export const INK_HEX = "#111827";
export const MUTED_HEX = "#4B5563";
export const SUBTLE_HEX = "#374151";
export const RULE_HEX = "#9CA3AF";

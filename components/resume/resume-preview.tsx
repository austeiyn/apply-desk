import type { CSSProperties } from "react";
import { resumeBlocks } from "@/lib/documents/layout";
import { MUTED_HEX, PREVIEW_FONT, resolveStyle, RULE_HEX, SUBTLE_HEX } from "@/lib/documents/templates";
import type { ResumeContent } from "@/lib/resume/types";

/**
 * On-screen preview built from the same block model and template spec as the
 * DOCX/PDF renderers, so what you see matches what you download.
 *
 * Sizes are in em: the page's base font size equals the template's body
 * size, and the wrapper maps 10pt to 11px (12px on larger screens).
 */
export function ResumePreview({ content }: { content: ResumeContent }) {
  const style = resolveStyle(content.style);
  const { spec, accentHex } = style;
  const blocks = resumeBlocks(content);
  const body = spec.size.body;
  const em = (points: number) => `${points / body}em`;
  const margin = `${(spec.margin / 595.28) * 100}%`;
  const center = spec.headerAlign === "center" ? "center" : undefined;
  const page: CSSProperties = {
    fontFamily: PREVIEW_FONT[spec.font],
    fontSize: `${body / 10}em`,
    lineHeight: spec.spacing.line,
    padding: margin,
  };

  return (
    <div className="mx-auto w-full max-w-[794px] text-[11px] sm:text-[12px]">
      <div
        className="document-page rounded-sm shadow-[0_1px_3px_rgba(15,26,43,0.12),0_8px_24px_-12px_rgba(15,26,43,0.18)] ring-1 ring-black/5"
        style={page}
        data-template={style.template}
      >
        {blocks.map((b, i) => {
          switch (b.type) {
            case "name":
              return (
                <p key={i} className="font-bold leading-tight" style={{ fontSize: em(spec.size.name), color: accentHex, textAlign: center }}>
                  {b.text}
                </p>
              );
            case "headline":
              return (
                <p key={i} style={{ fontSize: em(spec.size.headline), color: SUBTLE_HEX, marginTop: "0.15em", textAlign: center }}>
                  {b.text}
                </p>
              );
            case "contact":
              return (
                <p key={i} style={{ fontSize: em(spec.size.contact), color: MUTED_HEX, marginTop: "0.15em", textAlign: center }}>
                  {b.text}
                </p>
              );
            case "heading":
              return (
                <p
                  key={i}
                  className="font-bold"
                  style={{
                    fontSize: em(spec.size.heading),
                    color: accentHex,
                    marginTop: em(spec.spacing.section + 4),
                    marginBottom: em(5),
                    paddingBottom: em(2),
                    textTransform: spec.heading.uppercase ? "uppercase" : undefined,
                    letterSpacing: spec.heading.tracking ? em(spec.heading.tracking) : undefined,
                    borderBottom:
                      spec.heading.rule === "none" ? undefined : `${Math.max(1, spec.heading.ruleWeight * 1.4)}px solid ${spec.heading.rule === "accent" ? accentHex : RULE_HEX}`,
                  }}
                >
                  {b.text}
                </p>
              );
            case "paragraph":
              return (
                <p key={i} className="whitespace-pre-line">
                  {b.text}
                </p>
              );
            case "entry":
              return (
                <div key={i} style={{ marginTop: em(spec.spacing.entry + 2) }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-bold">{b.title}</p>
                    {b.dates ? (
                      <p className="shrink-0" style={{ color: MUTED_HEX }}>
                        {b.dates}
                      </p>
                    ) : null}
                  </div>
                  {b.subtitle ? <p style={{ color: SUBTLE_HEX, fontStyle: spec.subtitleItalic ? "italic" : undefined }}>{b.subtitle}</p> : null}
                </div>
              );
            case "bullet":
              return (
                <p key={i} className="relative pl-[1.4em]" style={{ marginTop: em(spec.spacing.bullet) }}>
                  <span className="absolute left-[0.4em]">•</span>
                  {b.text}
                </p>
              );
            default:
              return <div key={i} className="h-2" />;
          }
        })}
      </div>
    </div>
  );
}

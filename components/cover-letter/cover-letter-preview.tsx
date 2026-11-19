import { coverLetterParagraphs } from "@/lib/documents/layout";
import { MUTED_HEX, PREVIEW_FONT, resolveStyle, RULE_HEX, type ResumeStyle } from "@/lib/documents/templates";

/**
 * On-screen cover letter, using the same template spec as the PDF/DOCX
 * renderers. Sizes are in em relative to the template's body size; the
 * wrapper maps 10pt to 11px (12px on larger screens).
 */
export function CoverLetterPreview({
  style,
  header,
  content,
}: {
  style: ResumeStyle | undefined;
  header: { fullName: string; contact: string; recipient: string | null };
  content: string;
}) {
  const resolved = resolveStyle(style);
  const { spec, accentHex } = resolved;
  const { letter } = spec;
  const em = (points: number) => `${points / letter.bodySize}em`;
  const textAlign = spec.headerAlign === "center" ? "center" : undefined;
  const rule = letter.headerRule === "none" ? undefined : `${letter.headerRule === "accent" ? 2 : 1}px solid ${letter.headerRule === "accent" ? accentHex : RULE_HEX}`;

  return (
    <div className="mx-auto w-full max-w-[794px] text-[11px] sm:text-[12px]">
      <div
        className="document-page rounded-sm shadow-[0_1px_3px_rgba(15,26,43,0.12)] ring-1 ring-black/5"
        data-template={resolved.template}
        style={{ fontFamily: PREVIEW_FONT[spec.font], fontSize: `${letter.bodySize / 10}em`, padding: `${(letter.margin / 595.28) * 100}%`, lineHeight: 1.45 }}
      >
        <div style={{ textAlign, borderBottom: rule, paddingBottom: rule ? em(8) : undefined, marginBottom: em(rule ? 16 : 18) }}>
          <p className="font-bold leading-tight" style={{ fontSize: em(letter.nameSize), color: accentHex }}>
            {header.fullName}
          </p>
          {header.contact ? <p style={{ fontSize: em(spec.size.contact), color: MUTED_HEX, marginTop: "0.2em" }}>{header.contact}</p> : null}
        </div>
        <p>{new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}</p>
        {header.recipient ? <p style={{ marginTop: em(12) }}>{header.recipient}</p> : null}
        {coverLetterParagraphs(content).map((p, i) => (
          <p key={i} className="whitespace-pre-line" style={{ marginTop: em(i === 0 ? 12 : letter.paragraphGap) }}>
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}

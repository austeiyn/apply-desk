import { resumeBlocks } from "@/lib/documents/layout";
import type { ResumeContent } from "@/lib/resume/types";

/**
 * On-screen preview built from the same block model as the DOCX/PDF
 * renderers, so what you see matches what you download.
 */
export function ResumePreview({ content }: { content: ResumeContent }) {
  const blocks = resumeBlocks(content);
  return (
    <div className="document-page mx-auto w-full max-w-[794px] rounded-sm px-[6%] py-[6%] text-[11px] shadow-[0_1px_3px_rgba(15,26,43,0.12),0_8px_24px_-12px_rgba(15,26,43,0.18)] ring-1 ring-black/5 sm:text-[12px]">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "name":
            return (
              <p key={i} className="text-[1.75em] font-bold leading-tight">
                {b.text}
              </p>
            );
          case "headline":
            return (
              <p key={i} className="mt-0.5 text-[1.08em] text-gray-800">
                {b.text}
              </p>
            );
          case "contact":
            return (
              <p key={i} className="mt-0.5 text-[0.9em] text-gray-600">
                {b.text}
              </p>
            );
          case "heading":
            return (
              <p key={i} className="mb-1.5 mt-4 border-b border-gray-400 pb-0.5 text-[1.02em] font-bold uppercase tracking-wide">
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
              <div key={i} className="mt-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-bold">{b.title}</p>
                  {b.dates ? <p className="shrink-0 text-gray-600">{b.dates}</p> : null}
                </div>
                {b.subtitle ? <p className="italic text-gray-700">{b.subtitle}</p> : null}
              </div>
            );
          case "bullet":
            return (
              <p key={i} className="relative mt-0.5 pl-[1.3em]">
                <span className="absolute left-[0.35em]">•</span>
                {b.text}
              </p>
            );
          default:
            return <div key={i} className="h-2" />;
        }
      })}
    </div>
  );
}

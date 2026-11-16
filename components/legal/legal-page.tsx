import { TriangleAlert } from "lucide-react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="mb-8 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="note">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>Draft for review — not legal advice.</strong> This placeholder text describes how ApplyDesk is built to handle data. The
          platform owner must review it with a qualified adviser, complete the bracketed details and adapt it to the laws that apply
          (for example the NZ Privacy Act 2020, the Australian Privacy Act 1988 or the GDPR) before launch.
        </p>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-foreground/85 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
}

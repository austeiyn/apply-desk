"use client";

import { Check } from "lucide-react";
import {
  ACCENT_COLOURS,
  ACCENT_HEX,
  ACCENT_LABELS,
  RESUME_TEMPLATES,
  resolveStyle,
  TEMPLATE_SPECS,
  type AccentColour,
  type ResumeStyle,
  type ResumeTemplate,
} from "@/lib/documents/templates";
import { cn } from "@/lib/utils";

/** Template and accent colour for a resume. Applies to the preview and both downloads. */
export function StylePicker({ value, onChange }: { value: ResumeStyle | undefined; onChange: (style: ResumeStyle) => void }) {
  const current = resolveStyle(value);
  // Keep a colour the user picked; otherwise each template shows its own default.
  const setTemplate = (template: ResumeTemplate) => onChange({ template, ...(value?.accent ? { accent: value.accent } : {}) });
  const setAccent = (accent: AccentColour) => onChange({ template: current.template, accent });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <p id="template-label" className="mb-1.5 text-xs font-medium text-muted-foreground">
          Template
        </p>
        <div role="radiogroup" aria-labelledby="template-label" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {RESUME_TEMPLATES.map((t) => {
            const spec = TEMPLATE_SPECS[t];
            const active = current.template === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                title={spec.description}
                onClick={() => setTemplate(t)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  active ? "border-brand bg-brand/10 font-medium text-brand" : "hover:bg-muted",
                )}
              >
                <span style={{ fontFamily: spec.font === "serif" ? '"Times New Roman", "Liberation Serif", serif' : undefined }}>{spec.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{current.spec.description}</p>
      </div>
      <div>
        <p id="accent-label" className="mb-1.5 text-xs font-medium text-muted-foreground">
          Colour
        </p>
        <div role="radiogroup" aria-labelledby="accent-label" className="flex flex-wrap gap-2">
          {ACCENT_COLOURS.map((a) => {
            const active = current.accent === a;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={ACCENT_LABELS[a]}
                title={ACCENT_LABELS[a]}
                onClick={() => setAccent(a)}
                className={cn("flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition", active ? "ring-2 ring-brand" : "hover:scale-110")}
                style={{ backgroundColor: ACCENT_HEX[a] }}
              >
                {active ? <Check className="size-3.5 text-white" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

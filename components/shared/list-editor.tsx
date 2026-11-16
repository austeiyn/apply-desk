"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

/** Edit an ordered list of short texts (bullets, details, items). */
export function ListEditor({
  value,
  onChange,
  addLabel = "Add bullet",
  placeholder,
  max = 20,
  label,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  addLabel?: string;
  placeholder?: string;
  max?: number;
  label: string;
}) {
  const update = (i: number, text: string) => onChange(value.map((v, j) => (j === i ? text : v)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="group flex items-start gap-1.5">
          <span className="mt-2.5 text-xs text-muted-foreground" aria-hidden>
            •
          </span>
          <Textarea
            value={item}
            onChange={(e) => update(i, e.target.value)}
            rows={Math.min(6, Math.max(1, Math.ceil(item.length / 48)))}
            className="min-h-9 flex-1 resize-y py-1.5 [field-sizing:content]"
            placeholder={placeholder}
            aria-label={`${label} ${i + 1}`}
          />
          <div className="flex shrink-0 flex-col opacity-70 group-focus-within:opacity-100 group-hover:opacity-100">
            <button type="button" className="rounded p-0.5 hover:bg-muted disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              <ArrowUp className="size-3.5" />
            </button>
            <button type="button" className="rounded p-0.5 hover:bg-muted disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move down">
              <ArrowDown className="size-3.5" />
            </button>
          </div>
          <button
            type="button"
            className="mt-1.5 rounded p-1 text-muted-foreground opacity-70 hover:bg-rose-50 hover:text-destructive group-hover:opacity-100"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {value.length < max ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...value, ""])}>
          <Plus /> {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

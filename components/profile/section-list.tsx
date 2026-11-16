"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";

/** Card wrapper for a list-style profile section. */
export function SectionCard({
  title,
  description,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  description?: string;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {onAdd ? (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus /> {addLabel ?? "Add"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ItemRow({
  title,
  subtitle,
  meta,
  children,
  onEdit,
  onDelete,
  deleteLabel = "this item",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => Promise<unknown> | void;
  deleteLabel?: string;
}) {
  return (
    <div className="group flex gap-3 border-t py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="font-medium">{title}</p>
          {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
        </div>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        {children}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {onEdit ? (
          <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Edit">
            <Pencil />
          </Button>
        ) : null}
        {onDelete ? (
          <ConfirmButton title={`Delete ${deleteLabel}?`} description="This can't be undone." onConfirm={onDelete}>
            <Button size="icon-sm" variant="ghost" aria-label="Delete" className="text-muted-foreground hover:text-destructive">
              <Trash2 />
            </Button>
          </ConfirmButton>
        ) : null}
      </div>
    </div>
  );
}

export function SectionEmpty({ title, description, onAdd, addLabel }: { title: string; description: string; onAdd: () => void; addLabel: string }) {
  return (
    <EmptyState
      title={title}
      description={description}
      className="py-8"
      action={
        <Button size="sm" onClick={onAdd}>
          <Plus /> {addLabel}
        </Button>
      }
    />
  );
}

export function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {items.map((t) => (
        <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-xs">
          {t}
        </span>
      ))}
    </div>
  );
}

export function Bullets({ text, max = 4 }: { text: string; max?: number }) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground/80">
      {lines.slice(0, max).map((l, i) => (
        <li key={i}>{l}</li>
      ))}
      {lines.length > max ? <li className="list-none text-xs text-muted-foreground">+{lines.length - max} more</li> : null}
    </ul>
  );
}

"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { addSkillsAction, deleteSkillAction, updateSkillAction } from "@/app/dashboard/profile/actions";
import { TagInput } from "@/components/shared/tag-input";
import { useAction, useFormAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-controls";
import { Input, NativeSelect } from "@/components/ui/input";
import { PROFICIENCY_LEVELS, SKILL_CATEGORIES } from "@/lib/constants";
import type { Skill } from "@/lib/db/types";
import { skillsAddSchema, skillUpdateSchema, type SkillsAddInput, type SkillUpdateInput } from "@/lib/validation/profile";
import { SectionCard } from "./section-list";

function AddSkillsForm() {
  const form = useForm<SkillsAddInput>({
    resolver: zodResolver(skillsAddSchema) as never,
    defaultValues: { names: [], category: "technical", proficiency: "" },
  });
  const { onSubmit, pending } = useFormAction(form, addSkillsAction, {
    onSuccess: () => form.reset({ names: [], category: form.getValues("category"), proficiency: "" }),
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-[1fr_180px_150px_auto] sm:items-end" noValidate>
      <Field label="Add skills" htmlFor="names" error={form.formState.errors.names?.message as string | undefined}>
        <Controller
          control={form.control}
          name="names"
          render={({ field }) => (
            <TagInput id="names" value={(field.value as string[]) ?? []} onChange={field.onChange} placeholder="Type a skill and press Enter" />
          )}
        />
      </Field>
      <Field label="Category" htmlFor="category">
        <NativeSelect id="category" {...form.register("category")}>
          {SKILL_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Proficiency" htmlFor="proficiency" optional>
        <NativeSelect id="proficiency" {...form.register("proficiency")}>
          <option value="">—</option>
          {PROFICIENCY_LEVELS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button type="submit" loading={pending}>
        Add
      </Button>
    </form>
  );
}

function EditSkillDialog({ skill, onClose }: { skill: Skill | null; onClose: () => void }) {
  const form = useForm<SkillUpdateInput>({
    resolver: zodResolver(skillUpdateSchema) as never,
    values: {
      name: skill?.skill_name ?? "",
      category: (skill?.skill_category as SkillUpdateInput["category"]) ?? "technical",
      proficiency: (skill?.proficiency as SkillUpdateInput["proficiency"]) ?? "",
    },
  });
  const { onSubmit, pending } = useFormAction(form, (v) => updateSkillAction(skill!.id, v), { onSuccess: onClose });
  return (
    <Dialog open={!!skill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit skill</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Skill" htmlFor="skillName" error={form.formState.errors.name?.message}>
            <Input id="skillName" {...form.register("name")} />
          </Field>
          <Field label="Category" htmlFor="skillCategory">
            <NativeSelect id="skillCategory" {...form.register("category")}>
              {SKILL_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Proficiency" htmlFor="skillProficiency" optional>
            <NativeSelect id="skillProficiency" {...form.register("proficiency")}>
              <option value="">Not specified</option>
              {PROFICIENCY_LEVELS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SkillsSection({ skills }: { skills: Skill[] }) {
  const [editing, setEditing] = useState<Skill | null>(null);
  const { run: remove } = useAction(deleteSkillAction);
  const grouped = SKILL_CATEGORIES.map((c) => ({ ...c, items: skills.filter((s) => s.skill_category === c.value) })).filter((g) => g.items.length);

  return (
    <SectionCard
      title="Skills"
      description="Only list skills you can genuinely demonstrate. Job requirements you don't have here are shown as gaps instead of being added to your resume."
    >
      <div className="space-y-5">
        <AddSkillsForm />
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills yet. Add a few above, separated by Enter or commas.</p>
        ) : (
          grouped.map((g) => (
            <div key={g.value} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((s) => (
                  <span key={s.id} className="inline-flex items-center rounded-md border bg-card text-sm shadow-xs">
                    <button type="button" className="px-2.5 py-1 hover:text-brand" onClick={() => setEditing(s)} title="Edit skill">
                      {s.skill_name}
                      {s.proficiency ? <span className="ml-1.5 text-xs capitalize text-muted-foreground">{s.proficiency}</span> : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      className="border-l px-1.5 py-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${s.skill_name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <EditSkillDialog skill={editing} onClose={() => setEditing(null)} />
    </SectionCard>
  );
}

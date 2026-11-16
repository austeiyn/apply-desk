"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  deleteEducationAction,
  deleteExperienceAction,
  saveEducationAction,
  saveExperienceAction,
} from "@/app/dashboard/profile/actions";
import { TagInput } from "@/components/shared/tag-input";
import { useAction, useFormAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Field } from "@/components/ui/form-controls";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { EMPLOYMENT_TYPES, employmentTypeLabel } from "@/lib/constants";
import type { Education, WorkExperience } from "@/lib/db/types";
import { formatDateRange, formatMonthYear, toMonthInput } from "@/lib/utils";
import { educationSchema, experienceSchema, type EducationInput, type ExperienceInput } from "@/lib/validation/profile";
import { Bullets, ItemRow, SectionCard, SectionEmpty, TagList } from "./section-list";

/* Work experience ---------------------------------------------------------- */

function ExperienceDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: WorkExperience | null }) {
  const form = useForm<ExperienceInput>({
    resolver: zodResolver(experienceSchema) as never,
    values: {
      company: item?.company ?? "",
      jobTitle: item?.job_title ?? "",
      employmentType: (item?.employment_type as ExperienceInput["employmentType"]) ?? "",
      location: item?.location ?? "",
      startDate: toMonthInput(item?.start_date),
      endDate: toMonthInput(item?.end_date),
      isCurrent: item?.is_current ?? false,
      responsibilities: item?.responsibilities ?? "",
      achievements: item?.achievements ?? "",
      technologies: item?.technologies ?? [],
    },
  });
  const { onSubmit, pending } = useFormAction(form, (v) => saveExperienceAction(item?.id ?? null, v), {
    onSuccess: () => onOpenChange(false),
  });
  const e = form.formState.errors;
  const isCurrent = form.watch("isCurrent");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit role" : "Add a role"}</DialogTitle>
          <DialogDescription>Only include what you actually did. Generated documents never add details that aren&apos;t here.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Job title" htmlFor="jobTitle" error={e.jobTitle?.message} required>
            <Input id="jobTitle" {...form.register("jobTitle")} aria-invalid={!!e.jobTitle} />
          </Field>
          <Field label="Company" htmlFor="company" error={e.company?.message} required>
            <Input id="company" {...form.register("company")} aria-invalid={!!e.company} />
          </Field>
          <Field label="Employment type" htmlFor="employmentType" optional>
            <NativeSelect id="employmentType" {...form.register("employmentType")}>
              <option value="">Not specified</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Location" htmlFor="location" optional>
            <Input id="location" {...form.register("location")} />
          </Field>
          <Field label="Start date" htmlFor="startDate" error={e.startDate?.message}>
            <Input id="startDate" type="month" {...form.register("startDate")} />
          </Field>
          <Field label="End date" htmlFor="endDate" error={e.endDate?.message}>
            <Input id="endDate" type="month" disabled={isCurrent} {...form.register("endDate")} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Controller
              control={form.control}
              name="isCurrent"
              render={({ field }) => <Checkbox checked={!!field.value} onCheckedChange={(c) => field.onChange(c === true)} />}
            />
            I currently work here
          </label>
          <Field label="Responsibilities" htmlFor="responsibilities" className="sm:col-span-2" description="One per line." error={e.responsibilities?.message}>
            <Textarea id="responsibilities" rows={5} {...form.register("responsibilities")} />
          </Field>
          <Field
            label="Achievements"
            htmlFor="achievements"
            className="sm:col-span-2"
            description="One per line. Include real numbers where you have them, e.g. 'Cut page load time by 40%'."
            error={e.achievements?.message}
          >
            <Textarea id="achievements" rows={4} {...form.register("achievements")} />
          </Field>
          <Field label="Technologies and tools used" htmlFor="technologies" className="sm:col-span-2" optional>
            <Controller
              control={form.control}
              name="technologies"
              render={({ field }) => <TagInput id="technologies" value={(field.value as string[]) ?? []} onChange={field.onChange} max={100} />}
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {item ? "Save changes" : "Add role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExperienceSection({ items }: { items: WorkExperience[] }) {
  const [editing, setEditing] = useState<WorkExperience | null>(null);
  const [open, setOpen] = useState(false);
  const { run: remove } = useAction(deleteExperienceAction);
  const openFor = (item: WorkExperience | null) => {
    setEditing(item);
    setOpen(true);
  };

  return (
    <SectionCard title="Work experience" description="Your employment history, most recent first." onAdd={() => openFor(null)} addLabel="Add role">
      {items.length === 0 ? (
        <SectionEmpty
          title="No roles yet"
          description="Add your work history, or upload a CV and we'll extract it for you to review."
          onAdd={() => openFor(null)}
          addLabel="Add your first role"
        />
      ) : (
        items.map((x) => (
          <ItemRow
            key={x.id}
            title={`${x.job_title} · ${x.company}`}
            meta={formatDateRange(x.start_date, x.end_date, x.is_current)}
            subtitle={[employmentTypeLabel(x.employment_type), x.location].filter(Boolean).join(" · ") || undefined}
            onEdit={() => openFor(x)}
            onDelete={() => remove(x.id)}
            deleteLabel="this role"
          >
            <Bullets text={[x.responsibilities, x.achievements].filter(Boolean).join("\n")} />
            <TagList items={x.technologies} />
          </ItemRow>
        ))
      )}
      <ExperienceDialog open={open} onOpenChange={setOpen} item={editing} />
    </SectionCard>
  );
}

/* Education ---------------------------------------------------------------- */

function EducationDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: Education | null }) {
  const form = useForm<EducationInput>({
    resolver: zodResolver(educationSchema) as never,
    values: {
      institution: item?.institution ?? "",
      qualification: item?.qualification ?? "",
      fieldOfStudy: item?.field_of_study ?? "",
      startDate: toMonthInput(item?.start_date),
      graduationDate: toMonthInput(item?.graduation_date),
      achievements: item?.achievements ?? "",
    },
  });
  const { onSubmit, pending } = useFormAction(form, (v) => saveEducationAction(item?.id ?? null, v), {
    onSuccess: () => onOpenChange(false),
  });
  const e = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit education" : "Add education"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Qualification" htmlFor="qualification" error={e.qualification?.message} required description="e.g. Bachelor of Science">
            <Input id="qualification" {...form.register("qualification")} aria-invalid={!!e.qualification} />
          </Field>
          <Field label="Institution" htmlFor="institution" error={e.institution?.message} required>
            <Input id="institution" {...form.register("institution")} aria-invalid={!!e.institution} />
          </Field>
          <Field label="Field of study" htmlFor="fieldOfStudy" className="sm:col-span-2" optional>
            <Input id="fieldOfStudy" {...form.register("fieldOfStudy")} />
          </Field>
          <Field label="Start date" htmlFor="startDate" error={e.startDate?.message} optional>
            <Input id="startDate" type="month" {...form.register("startDate")} />
          </Field>
          <Field label="Graduation date" htmlFor="graduationDate" error={e.graduationDate?.message} optional>
            <Input id="graduationDate" type="month" {...form.register("graduationDate")} />
          </Field>
          <Field label="Relevant achievements" htmlFor="achievements" className="sm:col-span-2" description="Honours, awards, notable coursework. One per line." optional>
            <Textarea id="achievements" rows={3} {...form.register("achievements")} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {item ? "Save changes" : "Add education"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EducationSection({ items }: { items: Education[] }) {
  const [editing, setEditing] = useState<Education | null>(null);
  const [open, setOpen] = useState(false);
  const { run: remove } = useAction(deleteEducationAction);
  const openFor = (item: Education | null) => {
    setEditing(item);
    setOpen(true);
  };
  return (
    <SectionCard title="Education" onAdd={() => openFor(null)} addLabel="Add education">
      {items.length === 0 ? (
        <SectionEmpty title="No education added" description="Add degrees, diplomas or other qualifications." onAdd={() => openFor(null)} addLabel="Add education" />
      ) : (
        items.map((x) => (
          <ItemRow
            key={x.id}
            title={[x.qualification, x.field_of_study].filter(Boolean).join(", ")}
            subtitle={x.institution}
            meta={x.graduation_date ? formatMonthYear(x.graduation_date) : formatDateRange(x.start_date, null)}
            onEdit={() => openFor(x)}
            onDelete={() => remove(x.id)}
            deleteLabel="this education entry"
          >
            <Bullets text={x.achievements} max={3} />
          </ItemRow>
        ))
      )}
      <EducationDialog open={open} onOpenChange={setOpen} item={editing} />
    </SectionCard>
  );
}

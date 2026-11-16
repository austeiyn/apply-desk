"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink } from "lucide-react";
import {
  deleteCertificationAction,
  deleteExtraAction,
  deleteProjectAction,
  saveCertificationAction,
  saveExtraAction,
  saveProjectAction,
} from "@/app/dashboard/profile/actions";
import { TagInput } from "@/components/shared/tag-input";
import { useAction, useFormAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-controls";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { EXTRA_KINDS, type ExtraKind } from "@/lib/constants";
import type { Certification, ProfileExtra, Project } from "@/lib/db/types";
import { formatDateRange, formatMonthYear, toMonthInput } from "@/lib/utils";
import {
  certificationSchema,
  extraSchema,
  projectSchema,
  type CertificationInput,
  type ExtraInput,
  type ProjectInput,
} from "@/lib/validation/profile";
import { ItemRow, SectionCard, SectionEmpty, TagList } from "./section-list";

function useEditor<T>() {
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  return {
    editing,
    open,
    setOpen,
    openFor: (item: T | null) => {
      setEditing(item);
      setOpen(true);
    },
  };
}

function ExternalUrl({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
      <ExternalLink className="size-3" /> {new URL(href).hostname}
    </a>
  );
}

/* Certifications ----------------------------------------------------------- */
function CertificationDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: Certification | null }) {
  const form = useForm<CertificationInput>({
    resolver: zodResolver(certificationSchema) as never,
    values: {
      name: item?.name ?? "",
      institution: item?.institution ?? "",
      issueDate: toMonthInput(item?.issue_date),
      expiryDate: toMonthInput(item?.expiry_date),
      credentialId: item?.credential_id ?? "",
      credentialUrl: item?.credential_url ?? "",
    },
  });
  const { onSubmit, pending } = useFormAction(form, (v) => saveCertificationAction(item?.id ?? null, v), { onSuccess: () => onOpenChange(false) });
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit certification" : "Add certification"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Certification" htmlFor="certName" error={e.name?.message} className="sm:col-span-2" required>
            <Input id="certName" {...form.register("name")} aria-invalid={!!e.name} />
          </Field>
          <Field label="Issuing organisation" htmlFor="certInstitution" optional>
            <Input id="certInstitution" {...form.register("institution")} />
          </Field>
          <Field label="Credential ID" htmlFor="credentialId" optional>
            <Input id="credentialId" {...form.register("credentialId")} />
          </Field>
          <Field label="Issued" htmlFor="issueDate" error={e.issueDate?.message} optional>
            <Input id="issueDate" type="month" {...form.register("issueDate")} />
          </Field>
          <Field label="Expires" htmlFor="expiryDate" error={e.expiryDate?.message} optional>
            <Input id="expiryDate" type="month" {...form.register("expiryDate")} />
          </Field>
          <Field label="Credential URL" htmlFor="credentialUrl" error={e.credentialUrl?.message} className="sm:col-span-2" optional>
            <Input id="credentialUrl" inputMode="url" {...form.register("credentialUrl")} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

export function CertificationsSection({ items }: { items: Certification[] }) {
  const ed = useEditor<Certification>();
  const { run: remove } = useAction(deleteCertificationAction);
  return (
    <SectionCard title="Certifications" onAdd={() => ed.openFor(null)} addLabel="Add certification">
      {items.length === 0 ? (
        <SectionEmpty title="No certifications" description="Add professional certifications and licences." onAdd={() => ed.openFor(null)} addLabel="Add certification" />
      ) : (
        items.map((x) => (
          <ItemRow
            key={x.id}
            title={x.name}
            subtitle={x.institution ?? undefined}
            meta={[x.issue_date ? `Issued ${formatMonthYear(x.issue_date)}` : "", x.expiry_date ? `Expires ${formatMonthYear(x.expiry_date)}` : ""]
              .filter(Boolean)
              .join(" · ")}
            onEdit={() => ed.openFor(x)}
            onDelete={() => remove(x.id)}
            deleteLabel="this certification"
          >
            <ExternalUrl href={x.credential_url} />
          </ItemRow>
        ))
      )}
      <CertificationDialog open={ed.open} onOpenChange={ed.setOpen} item={ed.editing} />
    </SectionCard>
  );
}

/* Projects ----------------------------------------------------------------- */
function ProjectDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: Project | null }) {
  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema) as never,
    values: {
      title: item?.title ?? "",
      role: item?.role ?? "",
      description: item?.description ?? "",
      technologies: item?.technologies ?? [],
      projectUrl: item?.project_url ?? "",
      startDate: toMonthInput(item?.start_date),
      endDate: toMonthInput(item?.end_date),
    },
  });
  const { onSubmit, pending } = useFormAction(form, (v) => saveProjectAction(item?.id ?? null, v), { onSuccess: () => onOpenChange(false) });
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit project" : "Add project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Project title" htmlFor="projectTitle" error={e.title?.message} required>
            <Input id="projectTitle" {...form.register("title")} aria-invalid={!!e.title} />
          </Field>
          <Field label="Your role" htmlFor="projectRole" optional>
            <Input id="projectRole" {...form.register("role")} />
          </Field>
          <Field label="Description" htmlFor="projectDescription" className="sm:col-span-2" description="What you built, why, and the outcome.">
            <Textarea id="projectDescription" rows={4} {...form.register("description")} />
          </Field>
          <Field label="Technologies" htmlFor="projectTech" className="sm:col-span-2" optional>
            <Controller
              control={form.control}
              name="technologies"
              render={({ field }) => <TagInput id="projectTech" value={(field.value as string[]) ?? []} onChange={field.onChange} />}
            />
          </Field>
          <Field label="Start" htmlFor="projectStart" error={e.startDate?.message} optional>
            <Input id="projectStart" type="month" {...form.register("startDate")} />
          </Field>
          <Field label="End" htmlFor="projectEnd" error={e.endDate?.message} optional>
            <Input id="projectEnd" type="month" {...form.register("endDate")} />
          </Field>
          <Field label="Project URL" htmlFor="projectUrl" error={e.projectUrl?.message} className="sm:col-span-2" optional>
            <Input id="projectUrl" inputMode="url" {...form.register("projectUrl")} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

export function ProjectsSection({ items }: { items: Project[] }) {
  const ed = useEditor<Project>();
  const { run: remove } = useAction(deleteProjectAction);
  return (
    <SectionCard title="Projects" onAdd={() => ed.openFor(null)} addLabel="Add project">
      {items.length === 0 ? (
        <SectionEmpty title="No projects" description="Side projects, open source or notable work projects." onAdd={() => ed.openFor(null)} addLabel="Add project" />
      ) : (
        items.map((x) => (
          <ItemRow
            key={x.id}
            title={x.title}
            subtitle={x.role ?? undefined}
            meta={formatDateRange(x.start_date, x.end_date)}
            onEdit={() => ed.openFor(x)}
            onDelete={() => remove(x.id)}
            deleteLabel="this project"
          >
            {x.description ? <p className="line-clamp-3 text-sm text-foreground/80">{x.description}</p> : null}
            <TagList items={x.technologies} />
            <ExternalUrl href={x.project_url} />
          </ItemRow>
        ))
      )}
      <ProjectDialog open={ed.open} onOpenChange={ed.setOpen} item={ed.editing} />
    </SectionCard>
  );
}

/* Training, awards, volunteer, publications -------------------------------- */
function ExtraDialog({
  open,
  onOpenChange,
  item,
  kind,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: ProfileExtra | null;
  kind: ExtraKind;
}) {
  const form = useForm<ExtraInput>({
    resolver: zodResolver(extraSchema) as never,
    values: {
      kind: (item?.kind as ExtraKind) ?? kind,
      title: item?.title ?? "",
      organisation: item?.organisation ?? "",
      date: toMonthInput(item?.date),
      description: item?.description ?? "",
      url: item?.url ?? "",
    },
  });
  const { onSubmit, pending } = useFormAction(form, (v) => saveExtraAction(item?.id ?? null, v), { onSuccess: () => onOpenChange(false) });
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit entry" : "Add entry"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Type" htmlFor="extraKind">
            <NativeSelect id="extraKind" {...form.register("kind")}>
              {EXTRA_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Date" htmlFor="extraDate" error={e.date?.message} optional>
            <Input id="extraDate" type="month" {...form.register("date")} />
          </Field>
          <Field label="Title" htmlFor="extraTitle" error={e.title?.message} className="sm:col-span-2" required>
            <Input id="extraTitle" {...form.register("title")} aria-invalid={!!e.title} />
          </Field>
          <Field label="Organisation" htmlFor="extraOrg" className="sm:col-span-2" optional>
            <Input id="extraOrg" {...form.register("organisation")} />
          </Field>
          <Field label="Description" htmlFor="extraDescription" className="sm:col-span-2" optional>
            <Textarea id="extraDescription" rows={3} {...form.register("description")} />
          </Field>
          <Field label="Link" htmlFor="extraUrl" error={e.url?.message} className="sm:col-span-2" optional>
            <Input id="extraUrl" inputMode="url" {...form.register("url")} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

export function ExtrasSection({ items }: { items: ProfileExtra[] }) {
  const ed = useEditor<ProfileExtra>();
  const [kind, setKind] = useState<ExtraKind>("training");
  const { run: remove } = useAction(deleteExtraAction);
  return (
    <div className="space-y-4">
      {EXTRA_KINDS.map((k) => {
        const list = items.filter((i) => i.kind === k.value);
        return (
          <SectionCard
            key={k.value}
            title={k.label}
            onAdd={() => {
              setKind(k.value);
              ed.openFor(null);
            }}
            addLabel={`Add ${k.singular}`}
          >
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing added yet.</p>
            ) : (
              list.map((x) => (
                <ItemRow
                  key={x.id}
                  title={x.title}
                  subtitle={x.organisation ?? undefined}
                  meta={formatMonthYear(x.date)}
                  onEdit={() => ed.openFor(x)}
                  onDelete={() => remove(x.id)}
                  deleteLabel={`this ${k.singular}`}
                >
                  {x.description ? <p className="line-clamp-2 text-sm text-foreground/80">{x.description}</p> : null}
                  <ExternalUrl href={x.url} />
                </ItemRow>
              ))
            )}
          </SectionCard>
        );
      })}
      <ExtraDialog open={ed.open} onOpenChange={ed.setOpen} item={ed.editing} kind={kind} />
    </div>
  );
}

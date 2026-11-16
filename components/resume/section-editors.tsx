"use client";

import { useState } from "react";
import { Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { ListEditor } from "@/components/shared/list-editor";
import { TagInput } from "@/components/shared/tag-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Field } from "@/components/ui/form-controls";
import { Input, Textarea } from "@/components/ui/input";
import { newItemId, type ResumeContent } from "@/lib/resume/types";
import { fromMonthInput, toMonthInput } from "@/lib/utils";

type Update = (fn: (c: ResumeContent) => ResumeContent) => void;

/** Small "Regenerate with AI" control with an optional instruction. */
export function RegenerateButton({
  onRegenerate,
  running,
  disabled,
  label = "Regenerate",
}: {
  onRegenerate: (instructions: string) => Promise<void>;
  running: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)} loading={running} disabled={disabled} className="text-brand">
        {!running ? <Wand2 /> : null} {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate with AI</DialogTitle>
            <DialogDescription>The rewrite uses only your verified profile. You can review it before saving.</DialogDescription>
          </DialogHeader>
          <Field label="Guidance" htmlFor="regen-guidance" optional description='e.g. "Shorter", "Focus on stakeholder management"'>
            <Textarea id="regen-guidance" rows={2} maxLength={500} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setOpen(false);
                await onRegenerate(instructions);
                setInstructions("");
              }}
            >
              <Sparkles /> Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ContactEditor({ content, update }: { content: ResumeContent; update: Update }) {
  const c = content.contact;
  const set = (patch: Partial<ResumeContent["contact"]>) => update((x) => ({ ...x, contact: { ...x.contact, ...patch } }));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" htmlFor="c-name">
        <Input id="c-name" value={c.full_name} maxLength={200} onChange={(e) => set({ full_name: e.target.value })} />
      </Field>
      <Field label="Professional headline" htmlFor="c-headline">
        <Input id="c-headline" value={c.headline} maxLength={200} onChange={(e) => set({ headline: e.target.value })} />
      </Field>
      <Field label="Email" htmlFor="c-email">
        <Input id="c-email" value={c.email} maxLength={320} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      <Field label="Phone" htmlFor="c-phone">
        <Input id="c-phone" value={c.phone} maxLength={50} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label="Location" htmlFor="c-location" className="sm:col-span-2">
        <Input id="c-location" value={c.location} maxLength={200} onChange={(e) => set({ location: e.target.value })} />
      </Field>
      <div className="space-y-2 sm:col-span-2">
        <p className="text-[13px] font-medium">Links</p>
        {c.links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label="Link label"
              className="w-32"
              value={l.label}
              maxLength={40}
              onChange={(e) => set({ links: c.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
            />
            <Input
              aria-label="Link URL"
              value={l.url}
              maxLength={2048}
              onChange={(e) => set({ links: c.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
            />
            <Button type="button" size="icon" variant="ghost" aria-label="Remove link" onClick={() => set({ links: c.links.filter((_, j) => j !== i) })}>
              <Trash2 />
            </Button>
          </div>
        ))}
        {c.links.length < 6 ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => set({ links: [...c.links, { label: "Website", url: "" }] })}>
            <Plus /> Add link
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EntryHeader({ title, onRemove }: { title: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="truncate text-sm font-semibold">{title || "Untitled"}</p>
      <Button type="button" size="icon-sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${title || "entry"}`} className="text-muted-foreground hover:text-destructive">
        <Trash2 />
      </Button>
    </div>
  );
}

export function ExperienceEditor({
  content,
  update,
  onRegenerate,
  regenerating,
  aiConfigured,
}: {
  content: ResumeContent;
  update: Update;
  onRegenerate: (itemId: string, instructions: string) => Promise<void>;
  regenerating: string | null;
  aiConfigured: boolean;
}) {
  const setItem = (id: string, patch: Partial<ResumeContent["experience"][number]>) =>
    update((x) => ({ ...x, experience: x.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <div className="space-y-4">
      {content.experience.map((e) => (
        <div key={e.id} className="space-y-3 rounded-lg border p-3">
          <EntryHeader title={`${e.job_title} · ${e.company}`} onRemove={() => update((x) => ({ ...x, experience: x.experience.filter((y) => y.id !== e.id) }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Job title" htmlFor={`${e.id}-title`}>
              <Input id={`${e.id}-title`} value={e.job_title} maxLength={200} onChange={(ev) => setItem(e.id, { job_title: ev.target.value })} />
            </Field>
            <Field label="Company" htmlFor={`${e.id}-company`}>
              <Input id={`${e.id}-company`} value={e.company} maxLength={200} onChange={(ev) => setItem(e.id, { company: ev.target.value })} />
            </Field>
            <Field label="Location" htmlFor={`${e.id}-loc`}>
              <Input id={`${e.id}-loc`} value={e.location ?? ""} maxLength={200} onChange={(ev) => setItem(e.id, { location: ev.target.value || null })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start" htmlFor={`${e.id}-start`}>
                <Input id={`${e.id}-start`} type="month" value={toMonthInput(e.start_date)} onChange={(ev) => setItem(e.id, { start_date: fromMonthInput(ev.target.value) })} />
              </Field>
              <Field label="End" htmlFor={`${e.id}-end`}>
                <Input
                  id={`${e.id}-end`}
                  type="month"
                  disabled={e.is_current}
                  value={toMonthInput(e.end_date)}
                  onChange={(ev) => setItem(e.id, { end_date: fromMonthInput(ev.target.value) })}
                />
              </Field>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={e.is_current} onCheckedChange={(c) => setItem(e.id, { is_current: c === true, end_date: c === true ? null : e.end_date })} />
            Current role
          </label>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium">Bullet points</p>
            {aiConfigured && e.source_id ? (
              <RegenerateButton running={regenerating === e.id} disabled={regenerating !== null} onRegenerate={(ins) => onRegenerate(e.id, ins)} label="Regenerate bullets" />
            ) : null}
          </div>
          <ListEditor label="Bullet" value={e.bullets} onChange={(bullets) => setItem(e.id, { bullets })} max={20} />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          update((x) => ({
            ...x,
            experience: [
              ...x.experience,
              { id: newItemId("exp"), source_id: null, job_title: "Job title", company: "Company", location: null, start_date: null, end_date: null, is_current: false, bullets: [] },
            ],
          }))
        }
      >
        <Plus /> Add role
      </Button>
    </div>
  );
}

export function EducationEditor({ content, update }: { content: ResumeContent; update: Update }) {
  const setItem = (id: string, patch: Partial<ResumeContent["education"][number]>) =>
    update((x) => ({ ...x, education: x.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <div className="space-y-4">
      {content.education.map((e) => (
        <div key={e.id} className="space-y-3 rounded-lg border p-3">
          <EntryHeader title={e.qualification} onRemove={() => update((x) => ({ ...x, education: x.education.filter((y) => y.id !== e.id) }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Qualification" htmlFor={`${e.id}-q`}>
              <Input id={`${e.id}-q`} value={e.qualification} maxLength={200} onChange={(ev) => setItem(e.id, { qualification: ev.target.value })} />
            </Field>
            <Field label="Field of study" htmlFor={`${e.id}-f`}>
              <Input id={`${e.id}-f`} value={e.field_of_study ?? ""} maxLength={200} onChange={(ev) => setItem(e.id, { field_of_study: ev.target.value || null })} />
            </Field>
            <Field label="Institution" htmlFor={`${e.id}-i`}>
              <Input id={`${e.id}-i`} value={e.institution} maxLength={200} onChange={(ev) => setItem(e.id, { institution: ev.target.value })} />
            </Field>
            <Field label="Completed" htmlFor={`${e.id}-end`}>
              <Input id={`${e.id}-end`} type="month" value={toMonthInput(e.end_date)} onChange={(ev) => setItem(e.id, { end_date: fromMonthInput(ev.target.value) })} />
            </Field>
          </div>
          <ListEditor label="Detail" addLabel="Add detail" value={e.details} onChange={(details) => setItem(e.id, { details })} max={10} />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          update((x) => ({
            ...x,
            education: [...x.education, { id: newItemId("edu"), source_id: null, qualification: "Qualification", field_of_study: null, institution: "Institution", start_date: null, end_date: null, details: [] }],
          }))
        }
      >
        <Plus /> Add education
      </Button>
    </div>
  );
}

export function CertificationsEditor({ content, update }: { content: ResumeContent; update: Update }) {
  const setItem = (id: string, patch: Partial<ResumeContent["certifications"][number]>) =>
    update((x) => ({ ...x, certifications: x.certifications.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <div className="space-y-3">
      {content.certifications.map((c) => (
        <div key={c.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-end">
          <Field label="Certification" htmlFor={`${c.id}-n`}>
            <Input id={`${c.id}-n`} value={c.name} maxLength={200} onChange={(e) => setItem(c.id, { name: e.target.value })} />
          </Field>
          <Field label="Issuer" htmlFor={`${c.id}-i`}>
            <Input id={`${c.id}-i`} value={c.issuer ?? ""} maxLength={200} onChange={(e) => setItem(c.id, { issuer: e.target.value || null })} />
          </Field>
          <Field label="Date" htmlFor={`${c.id}-d`}>
            <Input id={`${c.id}-d`} type="month" value={toMonthInput(c.date)} onChange={(e) => setItem(c.id, { date: fromMonthInput(e.target.value) })} />
          </Field>
          <Button type="button" size="icon" variant="ghost" aria-label="Remove certification" onClick={() => update((x) => ({ ...x, certifications: x.certifications.filter((y) => y.id !== c.id) }))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => update((x) => ({ ...x, certifications: [...x.certifications, { id: newItemId("cert"), source_id: null, name: "", issuer: null, date: null }] }))}
      >
        <Plus /> Add certification
      </Button>
    </div>
  );
}

export function ProjectsEditor({ content, update }: { content: ResumeContent; update: Update }) {
  const setItem = (id: string, patch: Partial<ResumeContent["projects"][number]>) =>
    update((x) => ({ ...x, projects: x.projects.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <div className="space-y-4">
      {content.projects.map((p) => (
        <div key={p.id} className="space-y-3 rounded-lg border p-3">
          <EntryHeader title={p.title} onRemove={() => update((x) => ({ ...x, projects: x.projects.filter((y) => y.id !== p.id) }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" htmlFor={`${p.id}-t`}>
              <Input id={`${p.id}-t`} value={p.title} maxLength={200} onChange={(e) => setItem(p.id, { title: e.target.value })} />
            </Field>
            <Field label="URL" htmlFor={`${p.id}-u`}>
              <Input id={`${p.id}-u`} value={p.url ?? ""} maxLength={2048} onChange={(e) => setItem(p.id, { url: e.target.value || null })} />
            </Field>
          </div>
          <Field label="Technologies" htmlFor={`${p.id}-tech`}>
            <TagInput id={`${p.id}-tech`} value={p.technologies} onChange={(technologies) => setItem(p.id, { technologies })} max={30} />
          </Field>
          <ListEditor label="Bullet" value={p.bullets} onChange={(bullets) => setItem(p.id, { bullets })} max={10} />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => update((x) => ({ ...x, projects: [...x.projects, { id: newItemId("proj"), source_id: null, title: "Project", url: null, technologies: [], bullets: [] }] }))}
      >
        <Plus /> Add project
      </Button>
    </div>
  );
}

export function AdditionalEditor({ content, update }: { content: ResumeContent; update: Update }) {
  const setItem = (id: string, patch: Partial<ResumeContent["additional"][number]>) =>
    update((x) => ({ ...x, additional: x.additional.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <div className="space-y-4">
      {content.additional.map((a) => (
        <div key={a.id} className="space-y-3 rounded-lg border p-3">
          <EntryHeader title={a.heading} onRemove={() => update((x) => ({ ...x, additional: x.additional.filter((y) => y.id !== a.id) }))} />
          <Field label="Section heading" htmlFor={`${a.id}-h`} description="Use a standard heading such as Volunteer Experience, Awards or Training.">
            <Input id={`${a.id}-h`} value={a.heading} maxLength={80} onChange={(e) => setItem(a.id, { heading: e.target.value })} />
          </Field>
          <ListEditor label="Item" addLabel="Add item" value={a.items} onChange={(items) => setItem(a.id, { items })} max={15} />
        </div>
      ))}
      {content.additional.length < 6 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update((x) => ({ ...x, additional: [...x.additional, { id: newItemId("add"), heading: "Volunteer Experience", items: [] }] }))}
        >
          <Plus /> Add section
        </Button>
      ) : null}
    </div>
  );
}

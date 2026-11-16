"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, History, Info, MoreHorizontal, Save, Trash2, TriangleAlert } from "lucide-react";
import { deleteResumeAction, duplicateResumeAction, saveResumeAction } from "@/app/dashboard/documents/actions";
import { DownloadMenu } from "@/components/documents/download-menu";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { TagInput } from "@/components/shared/tag-input";
import { useAction } from "@/components/shared/use-action";
import { useAiJob } from "@/components/shared/use-ai-job";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/form-controls";
import { Input, Textarea } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { toast } from "@/components/ui/sonner";
import { ResumeContentSchema, SECTION_HEADINGS, type ResumeContent, type SectionKey } from "@/lib/resume/types";
import { cn, relativeTime } from "@/lib/utils";
import { ResumePreview } from "./resume-preview";
import {
  AdditionalEditor,
  CertificationsEditor,
  ContactEditor,
  EducationEditor,
  ExperienceEditor,
  ProjectsEditor,
  RegenerateButton,
} from "./section-editors";
import { VersionHistory, type VersionMeta } from "./version-history";

interface RegenResult {
  section: "summary" | "skills" | "experience";
  summary?: string;
  skills?: string[];
  bullets?: string[];
  warnings: string[];
  removedSkills: string[];
}

export function ResumeEditor({
  resumeId,
  initialTitle,
  initialContent,
  version,
  updatedAt,
  versions,
  aiConfigured,
  application,
}: {
  resumeId: string;
  initialTitle: string;
  initialContent: ResumeContent;
  version: number;
  updatedAt: string;
  versions: VersionMeta[];
  aiConfigured: boolean;
  application: { id: string; label: string } | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState<ResumeContent>(initialContent);
  const [saved, setSaved] = useState({ title: initialTitle, content: JSON.stringify(initialContent), version, updatedAt });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");

  // Re-sync when the server sends a new version (e.g. after a restore).
  // Adjusting state during render is React's recommended alternative to an effect.
  const [syncedVersion, setSyncedVersion] = useState(`${version}:${updatedAt}`);
  if (syncedVersion !== `${version}:${updatedAt}`) {
    setSyncedVersion(`${version}:${updatedAt}`);
    setTitle(initialTitle);
    setContent(initialContent);
    setSaved({ title: initialTitle, content: JSON.stringify(initialContent), version, updatedAt });
  }

  const dirty = title !== saved.title || JSON.stringify(content) !== saved.content;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = useCallback((fn: (c: ResumeContent) => ResumeContent) => setContent((c) => fn(c)), []);
  const validation = useMemo(() => ResumeContentSchema.safeParse(content), [content]);

  const save = useAction(saveResumeAction, {
    onSuccess: (d) => {
      setSaved({ title, content: JSON.stringify(content), version: d.version, updatedAt: d.updatedAt });
      router.refresh();
    },
  });
  const duplicate = useAction(duplicateResumeAction, { onSuccess: (d) => router.push(`/dashboard/resumes/${d.id}`) });
  const remove = useAction(deleteResumeAction, { onSuccess: () => router.push(application ? `/dashboard/applications/${application.id}?tab=resume` : "/dashboard/resumes") });
  const regen = useAiJob<RegenResult>("/api/ai/resume-section");

  const doSave = async (summary?: string) => {
    if (!validation.success) {
      toast.error("Some fields are too long or invalid. Check your entries.");
      return false;
    }
    const res = await save.run(resumeId, { title, content, changeSummary: summary });
    return res.ok;
  };

  const regenerate = async (section: "summary" | "skills" | "experience", instructions: string, itemId?: string) => {
    setRegenerating(itemId ?? section);
    const res = await regen.run({ resumeId, section, itemId, instructions: instructions || undefined, content });
    setRegenerating(null);
    if (!res.ok) return void toast.error(res.error);
    const r = res.data;
    update((c) => {
      if (r.section === "summary" && r.summary) return { ...c, summary: r.summary };
      if (r.section === "skills" && r.skills) return { ...c, skills: r.skills };
      if (r.section === "experience" && r.bullets && itemId) return { ...c, experience: c.experience.map((e) => (e.id === itemId ? { ...e, bullets: r.bullets! } : e)) };
      return c;
    });
    toast.success("Section rewritten. Review it, then save.");
    for (const w of r.warnings) toast.warning(w);
    if (r.removedSkills.length) toast.info(`Not added (not in your profile): ${r.removedSkills.join(", ")}`);
  };

  const moveSection = (key: SectionKey, dir: -1 | 1) =>
    update((c) => {
      const order = [...c.section_order];
      const i = order.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return c;
      [order[i], order[j]] = [order[j]!, order[i]!];
      return { ...c, section_order: order };
    });
  const toggleSection = (key: SectionKey) =>
    update((c) => ({
      ...c,
      hidden_sections: c.hidden_sections.includes(key) ? c.hidden_sections.filter((k) => k !== key) : [...c.hidden_sections, key],
    }));

  const sectionBody = (key: SectionKey) => {
    switch (key) {
      case "summary":
        return (
          <div className="space-y-2">
            <Textarea aria-label="Professional summary" rows={5} maxLength={3000} value={content.summary} onChange={(e) => update((c) => ({ ...c, summary: e.target.value }))} />
          </div>
        );
      case "skills":
        return <TagInput value={content.skills} onChange={(skills) => update((c) => ({ ...c, skills }))} max={60} placeholder="Add a skill" />;
      case "experience":
        return (
          <ExperienceEditor
            content={content}
            update={update}
            aiConfigured={aiConfigured}
            regenerating={regenerating}
            onRegenerate={(itemId, ins) => regenerate("experience", ins, itemId)}
          />
        );
      case "education":
        return <EducationEditor content={content} update={update} />;
      case "certifications":
        return <CertificationsEditor content={content} update={update} />;
      case "projects":
        return <ProjectsEditor content={content} update={update} />;
      case "additional":
        return <AdditionalEditor content={content} update={update} />;
    }
  };

  const gaps = content.meta.skill_gaps ?? [];
  const warnings = content.meta.warnings ?? [];

  const editor = (
    <div className="space-y-4">
      {warnings.length || gaps.length ? (
        <Alert variant="warning" title="Check before sending">
          {warnings.length ? (
            <ul className="list-disc space-y-0.5 pl-4">
              {warnings.map((w, i) => (
                <li key={i}>
                  <span className="capitalize">{w.section}</span>: {w.message}
                </li>
              ))}
            </ul>
          ) : null}
          {gaps.length ? (
            <p className={warnings.length ? "mt-2" : ""}>
              <strong>Skill gaps (not added to your resume):</strong> {gaps.map((g) => g.skill).join(", ")}.{" "}
              <Link href="/dashboard/profile?tab=skills" className="underline">
                Update your profile
              </Link>{" "}
              if you genuinely have any of these.
            </p>
          ) : null}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactEditor content={content} update={update} />
        </CardContent>
      </Card>

      {content.section_order.map((key, idx) => {
        const hidden = content.hidden_sections.includes(key);
        return (
          <Card key={key} className={hidden ? "opacity-70" : undefined}>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2">
                {key === "additional" ? "Additional sections" : SECTION_HEADINGS[key]}
                {hidden ? <span className="text-xs font-normal text-muted-foreground">(hidden)</span> : null}
              </CardTitle>
              <div className="flex items-center gap-0.5">
                {aiConfigured && (key === "summary" || key === "skills") ? (
                  <RegenerateButton running={regenerating === key} disabled={regenerating !== null} onRegenerate={(ins) => regenerate(key, ins)} />
                ) : null}
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => moveSection(key, -1)} disabled={idx === 0} aria-label={`Move ${SECTION_HEADINGS[key]} up`}>
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => moveSection(key, 1)}
                  disabled={idx === content.section_order.length - 1}
                  aria-label={`Move ${SECTION_HEADINGS[key]} down`}
                >
                  <ArrowDown />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => toggleSection(key)} aria-label={hidden ? `Show ${SECTION_HEADINGS[key]}` : `Hide ${SECTION_HEADINGS[key]}`}>
                  {hidden ? <Eye /> : <EyeOff />}
                </Button>
              </div>
            </CardHeader>
            {!hidden ? <CardContent>{sectionBody(key)}</CardContent> : null}
          </Card>
        );
      })}

      {content.meta.tailoring_notes?.length ? (
        <Alert variant="neutral" title="How this resume was tailored">
          <ul className="list-disc space-y-0.5 pl-4">
            {content.meta.tailoring_notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <Field label="Document title" htmlFor="resume-title" className="[&>label]:sr-only">
              <Input id="resume-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="h-9 text-base font-semibold" />
            </Field>
            <p className="mt-1 text-xs text-muted-foreground">
              {dirty ? <span className="font-medium text-warning">Unsaved changes</span> : `Version ${saved.version} · saved ${relativeTime(saved.updatedAt)}`}
              {application ? (
                <>
                  {" · "}
                  <Link className="text-brand hover:underline" href={`/dashboard/applications/${application.id}?tab=resume`}>
                    {application.label}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History /> History
            </Button>
            <DownloadMenu kind="resume" id={resumeId} beforeDownload={async () => (dirty ? doSave("Saved before download") : true)} />
            <Button size="sm" onClick={() => void doSave()} loading={save.pending} disabled={!dirty}>
              <Save /> Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => duplicate.run(resumeId)}>
                  <Copy /> Duplicate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ConfirmButton title="Delete this resume?" description="All versions of this resume will be permanently deleted." onConfirm={() => remove.run(resumeId)}>
              <Button size="icon-sm" variant="ghost" aria-label="Delete resume" className="text-muted-foreground hover:text-destructive">
                <Trash2 />
              </Button>
            </ConfirmButton>
          </div>
        </div>
      </div>

      {!validation.success ? (
        <Alert variant="error" title="Some content can't be saved">
          {validation.error.issues.slice(0, 3).map((i, k) => (
            <p key={k}>{i.path.join(" › ")}: {i.message}</p>
          ))}
        </Alert>
      ) : null}

      {/* Mobile: switch between editing and preview. Each panel renders once. */}
      <div className="lg:hidden">
        <Tabs value={view} onValueChange={(v) => setView(v as "edit" | "preview")}>
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn(view === "preview" && "hidden lg:block")}>{editor}</div>
        <div
          className={cn(
            "self-start rounded-xl bg-muted/50 p-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto",
            view === "edit" && "hidden lg:block",
          )}
        >
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" /> Live preview. Downloads use the same single-column, ATS-friendly layout.
          </p>
          <ResumePreview content={content} />
          {!dirty ? null : (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-warning">
              <TriangleAlert className="size-3.5" /> Downloads save your changes first.
            </p>
          )}
        </div>
      </div>

      <VersionHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        resumeId={resumeId}
        versions={versions}
        current={content}
        currentVersion={saved.version}
        dirty={dirty}
      />
    </div>
  );
}

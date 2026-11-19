"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { deleteCoverLetterAction, duplicateCoverLetterAction, saveCoverLetterAction } from "@/app/dashboard/documents/actions";
import { DownloadMenu } from "@/components/documents/download-menu";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useAction } from "@/components/shared/use-action";
import { useAiJob } from "@/components/shared/use-ai-job";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/form-controls";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { COVER_LETTER_TONES, type CoverLetterTone } from "@/lib/constants";
import { StylePicker } from "@/components/resume/style-picker";
import type { ResumeStyle } from "@/lib/documents/templates";
import { CoverLetterPreview } from "./cover-letter-preview";
import { relativeTime } from "@/lib/utils";

export function CoverLetterEditor({
  letterId,
  initial,
  header,
  application,
  aiConfigured,
}: {
  letterId: string;
  initial: { title: string; content: string; tone: CoverLetterTone; style: ResumeStyle | undefined; version: number; updatedAt: string };
  header: { fullName: string; contact: string; recipient: string | null };
  application: { id: string; label: string } | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [tone, setTone] = useState<CoverLetterTone>(initial.tone);
  const [style, setStyle] = useState<ResumeStyle | undefined>(initial.style);
  const [saved, setSaved] = useState(initial);

  // Re-sync when the server sends a new version (e.g. after regenerating).
  const [syncedKey, setSyncedKey] = useState(`${initial.version}:${initial.updatedAt}`);
  if (syncedKey !== `${initial.version}:${initial.updatedAt}`) {
    setSyncedKey(`${initial.version}:${initial.updatedAt}`);
    setTitle(initial.title);
    setContent(initial.content);
    setTone(initial.tone);
    setStyle(initial.style);
    setSaved(initial);
  }

  const dirty = title !== saved.title || content !== saved.content || tone !== saved.tone || JSON.stringify(style) !== JSON.stringify(saved.style);
  const save = useAction(saveCoverLetterAction, {
    onSuccess: (d) => {
      setSaved({ title, content, tone, style, version: d.version, updatedAt: new Date().toISOString() });
      router.refresh();
    },
  });
  const duplicate = useAction(duplicateCoverLetterAction, { onSuccess: (d) => router.push(`/dashboard/cover-letters/${d.id}`) });
  const remove = useAction(deleteCoverLetterAction, { onSuccess: () => router.push("/dashboard/cover-letters") });
  const regen = useAiJob<{ coverLetterId: string; warnings: string[] }>("/api/ai/cover-letter");

  const doSave = async () => (await save.run(letterId, { title, content, tone, style })).ok;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  const regenerate = async () => {
    if (!application) return;
    const res = await regen.run({ applicationId: application.id, tone, coverLetterId: letterId });
    if (res.ok) {
      res.data.warnings.forEach((w) => toast.warning(w));
      toast.success("Cover letter rewritten. The previous text was replaced.");
      router.refresh();
    } else toast.error(res.error);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <Field label="Document title" htmlFor="letter-title" className="[&>label]:sr-only">
            <Input id="letter-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="h-9 text-base font-semibold" />
          </Field>
          <p className="mt-1 text-xs text-muted-foreground">
            {dirty ? <span className="font-medium text-warning">Unsaved changes</span> : `Version ${saved.version} · saved ${relativeTime(saved.updatedAt)}`}
            {application ? (
              <>
                {" · "}
                <Link className="text-brand hover:underline" href={`/dashboard/applications/${application.id}?tab=cover-letter`}>
                  {application.label}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="Tone" value={tone} onChange={(e) => setTone(e.target.value as CoverLetterTone)} className="w-auto">
            {COVER_LETTER_TONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
          {aiConfigured && application ? (
            <ConfirmButton
              title="Rewrite this cover letter?"
              description="The AI will write a new version in the selected tone. Your current text will be replaced (save a duplicate first if you want to keep it)."
              confirmLabel="Rewrite"
              destructive={false}
              onConfirm={regenerate}
            >
              <Button size="sm" variant="outline" disabled={regen.running}>
                {regen.running ? <Loader2 className="animate-spin" /> : <Sparkles />} {regen.running ? (regen.progress ?? "Writing…") : "Regenerate"}
              </Button>
            </ConfirmButton>
          ) : null}
          <DownloadMenu kind="cover-letter" id={letterId} beforeDownload={async () => (dirty ? doSave() : true)} />
          <Button size="sm" onClick={() => void doSave()} loading={save.pending} disabled={!dirty}>
            <Save /> Save
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Duplicate" onClick={() => duplicate.run(letterId)}>
            <Copy />
          </Button>
          <ConfirmButton title="Delete this cover letter?" description="This can't be undone." onConfirm={() => remove.run(letterId)}>
            <Button size="icon-sm" variant="ghost" aria-label="Delete cover letter" className="text-muted-foreground hover:text-destructive">
              <Trash2 />
            </Button>
          </ConfirmButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 pt-5">
            <Field label="Letter" htmlFor="letter-body" description="Separate paragraphs with a blank line.">
              <Textarea id="letter-body" rows={24} maxLength={20000} value={content} onChange={(e) => setContent(e.target.value)} className="font-normal leading-relaxed" />
            </Field>
            <p className="text-xs text-muted-foreground">{words} words</p>
          </CardContent>
        </Card>
        <div className="space-y-3 rounded-xl bg-muted/50 p-4">
          <StylePicker value={style} onChange={setStyle} />
          <p className="text-xs text-muted-foreground">
            {application ? "New letters match the style of this application's resume; change it here if you like." : "Pick a style to match your resume."}
          </p>
          <CoverLetterPreview style={style} header={header} content={content} />
        </div>
      </div>
    </div>
  );
}

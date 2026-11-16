"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText, Loader2, PenSquare, ScrollText, Sparkles } from "lucide-react";
import { createBlankCoverLetterAction, createResumeFromProfileAction } from "@/app/dashboard/documents/actions";
import { DownloadMenu } from "@/components/documents/download-menu";
import { AiSetupNotice } from "@/components/shared/ai-setup-notice";
import { useAction } from "@/components/shared/use-action";
import { useAiJob } from "@/components/shared/use-ai-job";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Checkbox, Field } from "@/components/ui/form-controls";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { COVER_LETTER_TONES, type CoverLetterTone } from "@/lib/constants";
import type { ResumePreferences } from "@/lib/resume/types";
import { cn, relativeTime } from "@/lib/utils";

export interface DocSummary {
  id: string;
  title: string;
  version: number;
  updated_at: string;
  origin: string;
  tone?: string;
}

function DocRow({ doc, kind }: { doc: DocSummary; kind: "resume" | "cover-letter" }) {
  const href = kind === "resume" ? `/dashboard/resumes/${doc.id}` : `/dashboard/cover-letters/${doc.id}`;
  const Icon = kind === "resume" ? FileText : ScrollText;
  return (
    <div className="flex flex-col gap-3 border-t py-3 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <Link href={href} className="block truncate text-sm font-medium hover:text-brand">
            {doc.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            Version {doc.version} · Updated {relativeTime(doc.updated_at)}
            {doc.tone ? ` · ${COVER_LETTER_TONES.find((t) => t.value === doc.tone)?.label ?? doc.tone}` : ""}
          </p>
        </div>
        {doc.origin === "ai" ? (
          <Badge variant="brand" className="hidden sm:inline-flex">
            <Sparkles /> AI
          </Badge>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={href}>
            <PenSquare /> Open editor
          </Link>
        </Button>
        <DownloadMenu kind={kind} id={doc.id} />
      </div>
    </div>
  );
}

export function ResumePanel({
  applicationId,
  resumes,
  aiConfigured,
  isAdmin,
  hasDescription,
  defaultPrefs,
}: {
  applicationId: string;
  resumes: DocSummary[];
  aiConfigured: boolean;
  isAdmin: boolean;
  hasDescription: boolean;
  defaultPrefs: ResumePreferences;
}) {
  const router = useRouter();
  const job = useAiJob<{ resumeId: string; warnings: number; gaps: number }>("/api/ai/resume");
  const [prefs, setPrefs] = useState<ResumePreferences>(defaultPrefs);
  const manual = useAction(createResumeFromProfileAction, { onSuccess: (d) => router.push(`/dashboard/resumes/${d.id}`) });

  const generate = async () => {
    const res = await job.run({ applicationId, prefs });
    if (res.ok) {
      toast.success("Tailored resume created. Review it before you send it.");
      router.push(`/dashboard/resumes/${res.data.resumeId}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" /> Generate a tailored resume
          </CardTitle>
          <CardDescription>
            Written for this role from your verified profile. Employers, job titles, dates and qualifications are copied from your records, never invented.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!aiConfigured ? (
            <AiSetupNotice isAdmin={isAdmin} />
          ) : job.running ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center" role="status" aria-live="polite">
              <Loader2 className="size-6 animate-spin text-brand" />
              <p className="text-sm font-medium">{job.progress ?? "Writing…"}</p>
              <p className="text-xs text-muted-foreground">This usually takes 30–60 seconds.</p>
            </div>
          ) : (
            <>
              {job.error ? <Alert variant="error">{job.error}</Alert> : null}
              {!hasDescription ? <Alert variant="warning">Add the job description in the Overview tab first.</Alert> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Length" htmlFor="resumeLength">
                  <NativeSelect
                    id="resumeLength"
                    value={prefs.length}
                    onChange={(e) => setPrefs({ ...prefs, length: e.target.value as ResumePreferences["length"] })}
                  >
                    <option value="one_page">Concise (about one page)</option>
                    <option value="two_pages">Detailed (up to two pages)</option>
                  </NativeSelect>
                </Field>
                <Field label="Anything to emphasise?" htmlFor="emphasis" optional>
                  <Input
                    id="emphasis"
                    placeholder="e.g. leadership, accessibility work"
                    value={prefs.emphasis}
                    maxLength={500}
                    onChange={(e) => setPrefs({ ...prefs, emphasis: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {(
                  [
                    ["includeProjects", "Include relevant projects"],
                    ["includeCertifications", "Include certifications"],
                    ["includeAdditional", "Include awards, training and volunteering where relevant"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <Checkbox checked={prefs[key]} onCheckedChange={(c) => setPrefs({ ...prefs, [key]: c === true })} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={generate} disabled={!hasDescription}>
                  <Sparkles /> Generate tailored resume
                </Button>
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Prefer to write it yourself?{" "}
            <button className="text-brand underline-offset-2 hover:underline" onClick={() => manual.run(applicationId)} disabled={manual.pending}>
              Start from your profile without AI
            </button>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumes for this application</CardTitle>
        </CardHeader>
        <CardContent>
          {resumes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resumes yet.</p>
          ) : (
            resumes.map((r) => <DocRow key={r.id} doc={r} kind="resume" />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CoverLetterPanel({
  applicationId,
  letters,
  resumes,
  aiConfigured,
  isAdmin,
  hasDescription,
}: {
  applicationId: string;
  letters: DocSummary[];
  resumes: DocSummary[];
  aiConfigured: boolean;
  isAdmin: boolean;
  hasDescription: boolean;
}) {
  const router = useRouter();
  const job = useAiJob<{ coverLetterId: string; warnings: string[] }>("/api/ai/cover-letter");
  const [tone, setTone] = useState<CoverLetterTone>("professional");
  const [resumeId, setResumeId] = useState<string>(resumes[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const blank = useAction(createBlankCoverLetterAction, { onSuccess: (d) => router.push(`/dashboard/cover-letters/${d.id}`) });

  const generate = async () => {
    const res = await job.run({ applicationId, tone, resumeId: resumeId || undefined, notes: notes || undefined });
    if (res.ok) {
      for (const w of res.data.warnings) toast.warning(w);
      toast.success("Cover letter created. Review and personalise it before sending.");
      router.push(`/dashboard/cover-letters/${res.data.coverLetterId}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" /> Write a personalised cover letter
          </CardTitle>
          <CardDescription>Connects your real experience to this role&apos;s responsibilities, in the tone you choose.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!aiConfigured ? (
            <AiSetupNotice isAdmin={isAdmin} />
          ) : job.running ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center" role="status" aria-live="polite">
              <Loader2 className="size-6 animate-spin text-brand" />
              <p className="text-sm font-medium">{job.progress ?? "Writing…"}</p>
            </div>
          ) : (
            <>
              {job.error ? <Alert variant="error">{job.error}</Alert> : null}
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium">Tone</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {COVER_LETTER_TONES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={tone === t.value}
                      onClick={() => setTone(t.value)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors hover:border-brand/50",
                        tone === t.value && "border-brand bg-accent/40 ring-2 ring-brand/15",
                      )}
                    >
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Base it on this resume" htmlFor="coverResume" optional>
                  <NativeSelect id="coverResume" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                    <option value="">Use my profile only</option>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Anything specific to mention?" htmlFor="coverNotes" optional description="e.g. why this company appeals to you">
                  <Textarea id="coverNotes" rows={2} maxLength={800} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>
              <Button onClick={generate} disabled={!hasDescription}>
                <Sparkles /> Generate cover letter
              </Button>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            <button className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline" onClick={() => blank.run(applicationId)} disabled={blank.pending}>
              <FilePlus2 className="size-3" /> Write one from scratch
            </button>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cover letters for this application</CardTitle>
        </CardHeader>
        <CardContent>
          {letters.length === 0 ? (
            <EmptyState title="No cover letters yet" description="Generate one above or write your own." className="py-8" />
          ) : (
            letters.map((l) => <DocRow key={l.id} doc={l} kind="cover-letter" />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

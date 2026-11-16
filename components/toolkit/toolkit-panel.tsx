"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, FileQuestion, Loader2, Mail, MailPlus, Sparkles, Trash2, UserRound } from "lucide-react";
import { deleteMaterialAction } from "@/app/dashboard/toolkit/actions";
import { AiSetupNotice } from "@/components/shared/ai-setup-notice";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { CopyButton } from "@/components/shared/copy-button";
import { useAction } from "@/components/shared/use-action";
import { useAiJob } from "@/components/shared/use-ai-job";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field } from "@/components/ui/form-controls";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { DEFAULT_APPLICATION_QUESTIONS, FOLLOW_UP_KINDS, type FollowUpKind } from "@/lib/constants";
import type { ApplicationMaterial, JobApplication } from "@/lib/db/types";
import { cn, relativeTime } from "@/lib/utils";

type Tool = "application_email" | "professional_summary" | "application_answers" | "skill_gap" | "follow_up_email";

const TOOLS: Array<{ value: Tool; label: string; description: string; icon: typeof Mail }> = [
  { value: "application_email", label: "Application email", description: "Subject line, email body and an attachment checklist.", icon: Mail },
  { value: "application_answers", label: "Application questions", description: "Draft answers to common application form questions.", icon: FileQuestion },
  { value: "skill_gap", label: "Skill gap analysis", description: "Strengths, gaps and a focused learning plan.", icon: BarChart3 },
  { value: "follow_up_email", label: "Follow-up emails", description: "Follow-ups, thank-yous, and responding to offers.", icon: MailPlus },
  { value: "professional_summary", label: "Professional summary", description: "LinkedIn headline and About section, CV summary and short bio.", icon: UserRound },
];

/* Renderers for saved materials ---------------------------------------------- */

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <CopyButton text={text} size="icon-sm" label={`Copy ${label}`} />
      </div>
      <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function MaterialBody({ m }: { m: ApplicationMaterial }) {
  const c = m.content_json as Record<string, unknown>;
  const warnings = (c.warnings as string[] | undefined) ?? [];
  const warn = warnings.length ? <Alert variant="warning">{warnings.join(" ")}</Alert> : null;
  switch (m.kind) {
    case "application_email":
    case "follow_up_email":
      return (
        <div className="space-y-3">
          {warn}
          <Block label="Subject" text={String(c.subject ?? "")} />
          <Block label="Email" text={String(c.body ?? "")} />
          {Array.isArray(c.attachments) && c.attachments.length ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachment checklist</p>
              <ul className="space-y-1">
                {(c.attachments as string[]).map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Checkbox aria-label={a} /> {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      );
    case "professional_summary":
      return (
        <div className="space-y-3">
          {warn}
          <Block label="LinkedIn headline" text={String(c.linkedin_headline ?? "")} />
          <Block label="LinkedIn About" text={String(c.linkedin_about ?? "")} />
          <Block label="CV summary" text={String(c.cv_summary ?? "")} />
          <Block label="Short bio" text={String(c.short_bio ?? "")} />
        </div>
      );
    case "application_answers":
      return (
        <div className="space-y-4">
          {warn}
          {((c.answers as Array<{ question: string; answer: string; needs_input: string | null }>) ?? []).map((a, i) => (
            <div key={i} className="space-y-1.5">
              <Block label={a.question} text={a.answer} />
              {a.needs_input ? <p className="text-xs text-warning">You need to add: {a.needs_input}</p> : null}
            </div>
          ))}
        </div>
      );
    case "skill_gap": {
      const g = c as {
        existing_strengths: Array<{ skill: string; evidence: string }>;
        partial_matches: Array<{ skill: string; gap: string }>;
        missing_skills: Array<{ skill: string; importance: string; why_it_matters: string }>;
        learning_plan: Array<{ area: string; actions: string[]; timeframe: string }>;
        profile_improvements: string[];
      };
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-emerald-700">Verified strengths</h4>
            <ul className="space-y-1.5 text-sm">
              {g.existing_strengths?.map((s, i) => (
                <li key={i}>
                  <span className="font-medium">{s.skill}</span> — <span className="text-muted-foreground">{s.evidence}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-amber-700">Partially matched</h4>
            <ul className="space-y-1.5 text-sm">
              {g.partial_matches?.map((s, i) => (
                <li key={i}>
                  <span className="font-medium">{s.skill}</span> — <span className="text-muted-foreground">{s.gap}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-rose-700">Missing</h4>
            <ul className="space-y-1.5 text-sm">
              {g.missing_skills?.map((s, i) => (
                <li key={i}>
                  <span className="font-medium">{s.skill}</span> <span className="text-xs uppercase text-muted-foreground">({s.importance})</span> —{" "}
                  <span className="text-muted-foreground">{s.why_it_matters}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-brand">Suggested learning (not current experience)</h4>
            <ul className="space-y-2 text-sm">
              {g.learning_plan?.map((l, i) => (
                <li key={i}>
                  <p className="font-medium">
                    {l.area} <span className="text-xs font-normal text-muted-foreground">· {l.timeframe}</span>
                  </p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {l.actions.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
          {g.profile_improvements?.length ? (
            <section className="space-y-2 md:col-span-2">
              <h4 className="text-sm font-semibold">Profile improvements</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {g.profile_improvements.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      );
    }
    default:
      return null;
  }
}

/* Panel ---------------------------------------------------------------------- */

export function ToolkitPanel({
  application,
  materials,
  aiConfigured,
  isAdmin,
  hasDescription,
}: {
  application: JobApplication;
  materials: ApplicationMaterial[];
  aiConfigured: boolean;
  isAdmin: boolean;
  hasDescription: boolean;
}) {
  const router = useRouter();
  const [tool, setTool] = useState<Tool>("application_email");
  const [questions, setQuestions] = useState<string[]>(DEFAULT_APPLICATION_QUESTIONS.slice(0, 5));
  const [customQuestion, setCustomQuestion] = useState("");
  const [followKind, setFollowKind] = useState<FollowUpKind>("after_application");
  const [followNotes, setFollowNotes] = useState("");
  const job = useAiJob<{ materialId: string }>("/api/ai/toolkit");
  const remove = useAction(deleteMaterialAction, { onSuccess: () => router.refresh() });

  const run = async () => {
    const payload =
      tool === "application_answers"
        ? { tool, applicationId: application.id, questions: [...questions, ...(customQuestion.trim() ? [customQuestion.trim()] : [])] }
        : tool === "follow_up_email"
          ? { tool, applicationId: application.id, kind: followKind, notes: followNotes }
          : { tool, applicationId: application.id };
    const res = await job.run(payload);
    if (res.ok) {
      toast.success("Done. Saved below.");
      router.refresh();
    }
  };

  const visible = materials.filter((m) => m.kind === tool);

  return (
    <div className="space-y-6">
      {!aiConfigured ? <AiSetupNotice isAdmin={isAdmin} /> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {TOOLS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTool(t.value)}
            aria-pressed={tool === t.value}
            className={cn("rounded-lg border bg-card p-3 text-left transition-colors hover:border-brand/50", tool === t.value && "border-brand ring-2 ring-brand/15")}
          >
            <t.icon className="mb-1.5 size-4 text-brand" />
            <p className="text-sm font-medium">{t.label}</p>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{TOOLS.find((t) => t.value === tool)?.label}</CardTitle>
          <CardDescription>Generated from your verified profile and this job advertisement. Review everything before you use it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tool === "application_answers" ? (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-[13px] font-medium">Questions to answer</legend>
              {DEFAULT_APPLICATION_QUESTIONS.map((q) => (
                <label key={q} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={questions.includes(q)}
                    onCheckedChange={(c) => setQuestions((qs) => (c ? [...qs, q] : qs.filter((x) => x !== q)))}
                  />
                  {q}
                </label>
              ))}
              <Field label="Add your own question" htmlFor="customQuestion" optional>
                <Textarea id="customQuestion" rows={2} maxLength={500} value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)} />
              </Field>
            </fieldset>
          ) : null}
          {tool === "follow_up_email" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type of email" htmlFor="followKind">
                <NativeSelect id="followKind" value={followKind} onChange={(e) => setFollowKind(e.target.value as FollowUpKind)}>
                  {FOLLOW_UP_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Details to include" htmlFor="followNotes" optional description="e.g. what you discussed in the interview">
                <Textarea id="followNotes" rows={2} maxLength={800} value={followNotes} onChange={(e) => setFollowNotes(e.target.value)} />
              </Field>
            </div>
          ) : null}
          {job.error ? <Alert variant="error">{job.error}</Alert> : null}
          {aiConfigured ? (
            <Button onClick={run} loading={job.running} disabled={!hasDescription || (tool === "application_answers" && questions.length === 0 && !customQuestion.trim())}>
              {job.running ? (job.progress ?? "Working…") : (
                <>
                  <Sparkles /> Generate
                </>
              )}
            </Button>
          ) : null}
          {!hasDescription ? <p className="text-xs text-muted-foreground">Add the job description first.</p> : null}
        </CardContent>
      </Card>

      {job.running ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> {job.progress}
        </div>
      ) : null}

      {visible.map((m) => (
        <Card key={m.id}>
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle>{m.title}</CardTitle>
              <CardDescription>Generated {relativeTime(m.created_at)}</CardDescription>
            </div>
            <ConfirmButton title="Delete this item?" description="This can't be undone." onConfirm={() => remove.run(m.id)}>
              <Button size="icon-sm" variant="ghost" aria-label="Delete" className="text-muted-foreground hover:text-destructive">
                <Trash2 />
              </Button>
            </ConfirmButton>
          </CardHeader>
          <CardContent>
            <MaterialBody m={m} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

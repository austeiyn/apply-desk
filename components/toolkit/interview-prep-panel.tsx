"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, HelpCircle, Lightbulb, Loader2, MessagesSquare, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { saveInterviewNotesAction } from "@/app/dashboard/toolkit/actions";
import { AiSetupNotice } from "@/components/shared/ai-setup-notice";
import { useAction } from "@/components/shared/use-action";
import { useAiJob } from "@/components/shared/use-ai-job";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import type { InterviewPreparation } from "@/lib/db/types";
import { cn, relativeTime } from "@/lib/utils";

type Question = {
  category: "technical" | "behavioural" | "situational" | "experience" | "company_role";
  question: string;
  why_asked: string;
  answer_format: "star" | "direct";
  star: { situation: string; task: string; action: string; result: string } | null;
  answer: string | null;
  evidence_refs: string[];
  evidence_gap: string | null;
};

interface PrepContent {
  questions: Question[];
  questions_to_ask: string[];
  preparation_tips: string[];
  generated_at?: string;
}

const CATEGORY_LABELS: Record<Question["category"], string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  situational: "Situational",
  experience: "About your experience",
  company_role: "The company and role",
};

function QuestionCard({ q, index }: { q: Question; index: number }) {
  const [open, setOpen] = useState(index < 2);
  return (
    <div className="rounded-lg border">
      <button className="flex w-full items-start gap-3 p-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="mt-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
        <span className="flex-1 text-sm font-medium">{q.question}</span>
        {q.evidence_gap ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Limited evidence" /> : null}
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-3 border-t px-3 pb-3 pt-3 text-sm">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Why they ask:</span> {q.why_asked}
          </p>
          {q.star ? (
            <dl className="grid gap-2 sm:grid-cols-[90px_1fr]">
              {(["situation", "task", "action", "result"] as const).map((k) => (
                <div key={k} className="contents">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand">{k}</dt>
                  <dd className="leading-relaxed">{q.star![k]}</dd>
                </div>
              ))}
            </dl>
          ) : q.answer ? (
            <p className="leading-relaxed">{q.answer}</p>
          ) : null}
          {q.evidence_gap ? <Alert variant="warning">{q.evidence_gap}</Alert> : null}
        </div>
      ) : null}
    </div>
  );
}

export function InterviewPrepPanel({
  applicationId,
  prep,
  aiConfigured,
  isAdmin,
  hasDescription,
}: {
  applicationId: string;
  prep: InterviewPreparation | null;
  aiConfigured: boolean;
  isAdmin: boolean;
  hasDescription: boolean;
}) {
  const router = useRouter();
  const job = useAiJob<{ questions: number }>("/api/ai/interview-prep");
  const [notes, setNotes] = useState(prep?.notes ?? "");
  const saveNotes = useAction(saveInterviewNotesAction);
  const content = (prep?.content_json ?? null) as PrepContent | null;
  const hasQuestions = Boolean(content?.questions?.length);

  const generate = async () => {
    const res = await job.run({ applicationId });
    if (res.ok) {
      toast.success(`${res.data.questions} questions prepared.`);
      router.refresh();
    }
  };

  const grouped = (Object.keys(CATEGORY_LABELS) as Question["category"][])
    .map((cat) => ({ cat, items: (content?.questions ?? []).map((q, i) => ({ q, i })).filter(({ q }) => q.category === cat) }))
    .filter((g) => g.items.length);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {!aiConfigured ? <AiSetupNotice isAdmin={isAdmin} /> : null}
        {job.error ? <Alert variant="error">{job.error}</Alert> : null}
        {job.running ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center" role="status" aria-live="polite">
              <Loader2 className="size-7 animate-spin text-brand" />
              <p className="font-medium">{job.progress ?? "Preparing…"}</p>
            </CardContent>
          </Card>
        ) : !hasQuestions ? (
          <EmptyState
            icon={MessagesSquare}
            title="Prepare for your interview"
            description="Generate questions based on this advertisement, with suggested answers built from your real experience using the STAR method."
            action={
              aiConfigured ? (
                <Button onClick={generate} disabled={!hasDescription}>
                  <Sparkles /> Generate interview preparation
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {content!.questions.length} questions · generated {relativeTime(content!.generated_at ?? prep?.updated_at)}
              </p>
              {aiConfigured ? (
                <Button size="sm" variant="outline" onClick={generate}>
                  <RefreshCw /> Regenerate
                </Button>
              ) : null}
            </div>
            {grouped.map((g) => (
              <section key={g.cat} className="space-y-2">
                <h3 className="text-sm font-semibold">{CATEGORY_LABELS[g.cat]}</h3>
                {g.items.map(({ q, i }) => (
                  <QuestionCard key={i} q={q} index={i} />
                ))}
              </section>
            ))}
          </>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Your preparation notes</CardTitle>
            <CardDescription>Private notes for this interview, saved to your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea aria-label="Interview preparation notes" rows={10} maxLength={50000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button size="sm" onClick={() => saveNotes.run(applicationId, notes)} loading={saveNotes.pending} disabled={notes === (prep?.notes ?? "")}>
              Save notes
            </Button>
          </CardContent>
        </Card>
        {content?.questions_to_ask?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="size-4 text-brand" /> Questions to ask them
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {content.questions_to_ask.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        {content?.preparation_tips?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4 text-brand" /> Preparation tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {content.preparation_tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

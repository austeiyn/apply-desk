"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CircleDashed, HelpCircle, Lightbulb, Loader2, RefreshCw, Sparkles, TriangleAlert, XCircle } from "lucide-react";
import { AiSetupNotice } from "@/components/shared/ai-setup-notice";
import { useAiJob } from "@/components/shared/use-ai-job";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/feedback";
import { toast } from "@/components/ui/sonner";
import type { StoredJobAnalysis } from "@/lib/ai/job-analyser";
import { cn, relativeTime } from "@/lib/utils";

const MATCH = {
  strong: { label: "Strong match", icon: CheckCircle2, className: "bg-mint-50 text-mint-700 ring-mint-200" },
  partial: { label: "Partial match", icon: CircleDashed, className: "bg-sun-50 text-sun-700 ring-sun-200" },
  not_evidenced: { label: "Not evidenced", icon: HelpCircle, className: "bg-slate-100 text-slate-700 ring-slate-200" },
  missing_qualification: { label: "Missing qualification", icon: XCircle, className: "bg-coral-50 text-coral-700 ring-coral-200" },
} as const;

const RATING = {
  strong: { label: "Strong fit", className: "bg-mint-600" },
  good: { label: "Good fit", className: "bg-grape-500" },
  moderate: { label: "Moderate fit", className: "bg-sun-500" },
  limited: { label: "Limited fit", className: "bg-slate-500" },
} as const;

function MatchBadge({ match }: { match: keyof typeof MATCH }) {
  const m = MATCH[match];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", m.className)}>
      <m.icon className="size-3" aria-hidden /> {m.label}
    </span>
  );
}

function ListCard({ title, items, icon: Icon, tone }: { title: string; items: string[]; icon: typeof CheckCircle2; tone: string }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={cn("size-4", tone)} /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", tone.replace("text-", "bg-"))} />
              {s}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AnalysisPanel({
  applicationId,
  analysis,
  analysedAt,
  aiConfigured,
  isAdmin,
  hasDescription,
}: {
  applicationId: string;
  analysis: StoredJobAnalysis | null;
  analysedAt: string | null;
  aiConfigured: boolean;
  isAdmin: boolean;
  hasDescription: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const job = useAiJob<{ applicationId: string }>("/api/ai/analyse");
  const autoStarted = useRef(false);

  const run = async () => {
    const res = await job.run({ applicationId });
    if (res.ok) {
      toast.success("Analysis complete.");
      router.refresh();
    }
  };

  // Auto-start once when arriving from "Save and analyse".
  useEffect(() => {
    if (params.get("analyse") === "1" && !analysis && aiConfigured && hasDescription && !autoStarted.current) {
      autoStarted.current = true;
      const next = new URLSearchParams(params);
      next.delete("analyse");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!aiConfigured) return <AiSetupNotice isAdmin={isAdmin} />;

  if (job.running) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center" role="status" aria-live="polite">
          <Loader2 className="size-7 animate-spin text-brand" />
          <p className="font-medium">{job.progress ?? "Analysing…"}</p>
          <p className="max-w-sm text-sm text-muted-foreground">We&apos;re mapping each requirement to evidence in your profile. This usually takes under a minute.</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <div className="space-y-4">
        {job.error ? <Alert variant="error">{job.error}</Alert> : null}
        <EmptyState
          icon={Sparkles}
          title="Analyse this job"
          description={
            hasDescription
              ? "See a transparent requirements matrix, your strengths, genuine gaps and the ATS keywords to target."
              : "Add the job description in the Overview tab first, then run the analysis."
          }
          action={
            <Button onClick={run} disabled={!hasDescription}>
              <Sparkles /> Analyse job fit
            </Button>
          }
        />
      </div>
    );
  }

  const rating = RATING[analysis.overall.rating];
  const c = analysis.meta.counts;
  const total = analysis.requirements.length;

  return (
    <div className="space-y-6">
      {job.error ? <Alert variant="error">{job.error}</Alert> : null}
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5 md:flex-row md:items-start">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold text-white", rating.className)}>{rating.label}</span>
              <span className="text-xs text-muted-foreground">Analysed {relativeTime(analysedAt)}</span>
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{analysis.overall.headline}</h3>
            <p className="text-sm leading-relaxed text-foreground/85">{analysis.overall.explanation}</p>
            <p className="text-xs text-muted-foreground">
              This is a guide to help you decide and prepare, based only on your profile. It isn&apos;t a prediction of whether you&apos;ll be hired.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-center md:w-64">
            {(
              [
                ["strong", c.strong],
                ["partial", c.partial],
                ["not_evidenced", c.not_evidenced],
                ["missing_qualification", c.missing_qualification],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-lg border p-2">
                <p className="text-xl font-semibold tabular-nums">{v}</p>
                <p className="text-[11px] text-muted-foreground">{MATCH[k].label}</p>
              </div>
            ))}
            <p className="col-span-2 text-xs text-muted-foreground">
              {c.strong + c.partial} of {total} requirements evidenced
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>Requirements matrix</CardTitle>
            <CardDescription>Each requirement from the advertisement, mapped to evidence in your profile.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={run}>
            <RefreshCw /> Re-analyse
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="pl-5">Job requirement</TH>
                <TH>Your evidence</TH>
                <TH className="pr-5">Match</TH>
              </TR>
            </THead>
            <TBody>
              {analysis.requirements.map((r, i) => (
                <TR key={i}>
                  <TD className="min-w-48 pl-5 align-top">
                    <p className="font-medium">{r.requirement}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {r.importance} · {r.category.replace(/_/g, " ")}
                    </p>
                  </TD>
                  <TD className="min-w-56 align-top">
                    <p className={cn("text-sm", !r.evidence && "italic text-muted-foreground")}>{r.evidence ?? "No evidence in your profile"}</p>
                    {r.explanation ? <p className="mt-0.5 text-xs text-muted-foreground">{r.explanation}</p> : null}
                  </TD>
                  <TD className="pr-5 align-top">
                    <MatchBadge match={r.match} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard title="Your strengths for this role" items={analysis.strengths} icon={CheckCircle2} tone="text-mint-600" />
        <ListCard title="Potential gaps" items={analysis.gaps} icon={TriangleAlert} tone="text-sun-600" />
      </div>

      {analysis.clarifying_questions.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="size-4 text-brand" /> Do you have experience we haven&apos;t captured?
            </CardTitle>
            <CardDescription>
              These requirements aren&apos;t evidenced in your profile, so they won&apos;t appear in your documents. If you genuinely have the experience, add it to your profile and re-analyse.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {analysis.clarifying_questions.map((q, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  <span className="font-medium">{q.skill}:</span> {q.question}
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/profile?tab=experience">Update profile</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ATS keywords</CardTitle>
            <CardDescription>Terms an applicant tracking system may screen for. Use them where they truthfully describe your experience.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {analysis.job.ats_keywords.map((k) => (
              <Badge key={k} variant="outline" className="text-foreground">
                {k}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <ListCard title="Recommendations" items={analysis.recommendations} icon={Lightbulb} tone="text-brand" />
      </div>

      {analysis.job.key_phrases.length || analysis.job.differentiators.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ListCard title="Phrases the employer uses" items={analysis.job.key_phrases} icon={Sparkles} tone="text-ocean-600" />
          <ListCard title="What could set applicants apart" items={analysis.job.differentiators} icon={Sparkles} tone="text-grape-600" />
        </div>
      ) : null}
    </div>
  );
}

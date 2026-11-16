import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat, Table, TBody, TD, TH, THead, TR } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/session";
import { getActivitySeries, parseDays } from "@/lib/data/admin";
import { isAiConfigured, serverEnv } from "@/lib/env.server";
import { getPlatformSettings } from "@/lib/settings";
import { RangeSelect } from "../range-select";

export const metadata: Metadata = { title: "AI Usage" };

const FEATURE_LABELS: Record<string, string> = {
  "cv.extract": "CV extraction",
  "job.analyse": "Job analysis",
  "resume.generate": "Resume generation",
  "resume.section.summary": "Resume: summary rewrite",
  "resume.section.skills": "Resume: skills rewrite",
  "resume.section.experience": "Resume: bullets rewrite",
  "cover_letter.generate": "Cover letter",
  "interview.prepare": "Interview preparation",
  "toolkit.application_email": "Application email",
  "toolkit.professional_summary": "Professional summary",
  "toolkit.application_answers": "Application answers",
  "toolkit.skill_gap": "Skill gap analysis",
  "toolkit.follow_up_email": "Follow-up email",
};

const fmt = (n: number) => n.toLocaleString("en-NZ");

export default async function AdminAiUsagePage({ searchParams }: PageProps<"/admin/ai-usage">) {
  const { supabase } = await requireAdmin();
  const days = parseDays((await searchParams).days);
  const [byFeature, byModel, series, settings] = await Promise.all([
    supabase.rpc("admin_ai_usage_by_feature", { p_days: days }),
    supabase.rpc("admin_ai_usage_by_model", { p_days: days }),
    getActivitySeries(supabase, days),
    getPlatformSettings(),
  ]);
  const features = (byFeature.data ?? []).map((f) => ({ ...f, requests: Number(f.requests), errors: Number(f.errors), input_tokens: Number(f.input_tokens), output_tokens: Number(f.output_tokens) }));
  const totals = features.reduce((a, f) => ({ requests: a.requests + f.requests, errors: a.errors + f.errors, input: a.input + f.input_tokens, output: a.output + f.output_tokens }), {
    requests: 0,
    errors: 0,
    input: 0,
    output: 0,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Usage"
        description="Requests and tokens by feature and model. Prompts and generated content are not stored or shown."
        actions={
          <Suspense>
            <RangeSelect value={days} />
          </Suspense>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-5 text-sm">
          <span>
            Integration:{" "}
            {isAiConfigured() ? <Badge variant="success">Configured</Badge> : <Badge variant="danger">ANTHROPIC_API_KEY missing</Badge>}
          </span>
          <span>
            Model: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{serverEnv.anthropicModel}</code>
          </span>
          <span>Fast mode: {serverEnv.anthropicFastMode ? "on" : "off"}</span>
          <span>
            Limits: {settings.ai_daily_request_limit || "∞"}/day · {settings.ai_monthly_request_limit || "∞"}/30 days per user{" "}
            <Link href="/admin/settings" className="text-brand hover:underline">
              Change
            </Link>
          </span>
          {!settings.ai_enabled ? <Badge variant="warning">AI disabled in settings</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Requests" value={fmt(totals.requests)} hint={`last ${days} days`} />
        <Stat label="Failed or refused" value={fmt(totals.errors)} hint={totals.requests ? `${((totals.errors / totals.requests) * 100).toFixed(1)}% of requests` : undefined} />
        <Stat label="Input tokens" value={fmt(totals.input)} />
        <Stat label="Output tokens" value={fmt(totals.output)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI requests per day</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeSeriesChart data={series} xKey="label" ariaLabel={`AI requests per day over the last ${days} days`} series={[{ key: "ai_requests", label: "AI requests" }]} height={180} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>By feature</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="pl-5">Feature</TH>
                  <TH className="text-right">Requests</TH>
                  <TH className="text-right">Failed</TH>
                  <TH className="text-right">Input tokens</TH>
                  <TH className="text-right">Output tokens</TH>
                  <TH className="pr-5 text-right">Avg time</TH>
                </TR>
              </THead>
              <TBody>
                {features.length === 0 ? (
                  <TR>
                    <TD colSpan={6} className="pl-5 text-muted-foreground">
                      No AI requests in this period.
                    </TD>
                  </TR>
                ) : (
                  features.map((f) => (
                    <TR key={f.feature}>
                      <TD className="pl-5">{FEATURE_LABELS[f.feature] ?? f.feature}</TD>
                      <TD className="text-right tabular-nums">{fmt(f.requests)}</TD>
                      <TD className="text-right tabular-nums">{fmt(f.errors)}</TD>
                      <TD className="text-right tabular-nums">{fmt(f.input_tokens)}</TD>
                      <TD className="text-right tabular-nums">{fmt(f.output_tokens)}</TD>
                      <TD className="pr-5 text-right tabular-nums">{f.avg_duration_ms ? `${(Number(f.avg_duration_ms) / 1000).toFixed(1)}s` : "—"}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By model</CardTitle>
            <CardDescription>Includes requests served by a fallback model.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(byModel.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              (byModel.data ?? []).map((m) => (
                <div key={m.model} className="flex items-center justify-between gap-2 text-sm">
                  <code className="truncate rounded bg-muted px-1.5 py-0.5 text-xs">{m.model}</code>
                  <span className="tabular-nums text-muted-foreground">
                    {fmt(Number(m.requests))} req · {fmt(Number(m.input_tokens) + Number(m.output_tokens))} tokens
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

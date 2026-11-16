import type { Metadata } from "next";
import { Suspense } from "react";
import { BreakdownBars, TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/session";
import { STATUS_META, type ApplicationStatus } from "@/lib/constants";
import { getActivitySeries, getPlatformStats, parseDays } from "@/lib/data/admin";
import { RangeSelect } from "../range-select";

export const metadata: Metadata = { title: "Applications Analytics" };

export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const { supabase } = await requireAdmin();
  const days = parseDays((await searchParams).days);
  const [stats, series, breakdown] = await Promise.all([getPlatformStats(supabase), getActivitySeries(supabase, days), supabase.rpc("admin_application_status_breakdown")]);

  const totals = series.reduce((a, r) => ({ applications: a.applications + r.applications, resumes: a.resumes + r.resumes, cover_letters: a.cover_letters + r.cover_letters }), {
    applications: 0,
    resumes: 0,
    cover_letters: 0,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications Analytics"
        description="Aggregate counts only. Individual applications are never shown."
        actions={
          <Suspense>
            <RangeSelect value={days} />
          </Suspense>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Applications (${days}d)`} value={totals.applications} hint={`${stats.total_applications} all time`} />
        <Stat label={`Resumes (${days}d)`} value={totals.resumes} hint={`${stats.total_resumes} all time`} />
        <Stat label={`Cover letters (${days}d)`} value={totals.cover_letters} hint={`${stats.total_cover_letters} all time`} />
        <Stat label="Applications per candidate" value={stats.avg_applications_per_user} hint={`${stats.total_interview_preps} interview preps · ${stats.total_source_cvs} CVs uploaded`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Documents and applications created</CardTitle>
            <CardDescription>Per day, last {days} days.</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart
              data={series}
              xKey="label"
              ariaLabel={`Applications, resumes and cover letters created per day over the last ${days} days`}
              series={[
                { key: "applications", label: "Applications" },
                { key: "resumes", label: "Resumes" },
                { key: "cover_letters", label: "Cover letters" },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Applications by status</CardTitle>
            <CardDescription>Where candidates&apos; applications currently stand (all time).</CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownBars
              rows={(breakdown.data ?? []).map((r) => ({
                label: STATUS_META[r.application_status as ApplicationStatus]?.label ?? r.application_status,
                value: Number(r.total),
                dotClass: STATUS_META[r.application_status as ApplicationStatus]?.dot,
              }))}
              valueLabel="Applications"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Briefcase, CheckCircle2, FileText, ScrollText, TriangleAlert, UserPlus, Users, Activity, XCircle } from "lucide-react";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/session";
import { getActivitySeries, getPlatformStats } from "@/lib/data/admin";
import { isAiConfigured, isServiceRoleConfigured, serverEnv } from "@/lib/env.server";
import { publicEnv } from "@/lib/env";
import { getPlatformSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

function HealthRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3 py-2">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();
  const [stats, series, settings, audit] = await Promise.all([
    getPlatformStats(supabase),
    getActivitySeries(supabase, 30),
    getPlatformSettings(),
    supabase.from("audit_logs").select("id, action, actor_email, target_type, created_at").order("created_at", { ascending: false }).limit(6),
  ]);
  const aiReady = isAiConfigured();
  const appUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Aggregated platform activity. Candidate documents, CVs and notes are never shown here." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total users" value={stats.total_users} hint={`${stats.total_candidates} candidates · ${stats.total_admins} admins`} icon={Users} tone="grape" />
        <Stat label="New this month" value={stats.new_users_this_month} hint={`${stats.new_users_last_month} last month`} icon={UserPlus} tone="ocean" />
        <Stat label="Active users (30 days)" value={stats.active_users_30d} hint={`${stats.active_users_7d} in the last 7 days`} icon={Activity} tone="mint" />
        <Stat label="Suspended" value={stats.suspended_users} icon={TriangleAlert} tone="coral" />
        <Stat label="Applications created" value={stats.total_applications} hint={`${stats.avg_applications_per_user} per candidate on average`} icon={Briefcase} tone="sun" />
        <Stat label="Resumes generated" value={stats.total_resumes} icon={FileText} tone="bloom" />
        <Stat label="Cover letters" value={stats.total_cover_letters} icon={ScrollText} tone="ocean" />
        <Stat label="AI requests" value={stats.total_ai_requests} hint={`${stats.ai_requests_30d} in 30 days · ${stats.ai_errors_30d} failed`} icon={Bot} tone="grape" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Activity, last 30 days</CardTitle>
            <CardDescription>New registrations, applications and AI requests per day.</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart
              data={series}
              xKey="label"
              ariaLabel="Daily registrations, applications and AI requests over the last 30 days"
              series={[
                { key: "registrations", label: "Registrations" },
                { key: "applications", label: "Applications" },
                { key: "ai_requests", label: "AI requests" },
              ]}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System health</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                <HealthRow ok label="Database and authentication" detail="Connected (this page loaded live statistics)." />
                <HealthRow ok={isServiceRoleConfigured()} label="Server credentials" detail={isServiceRoleConfigured() ? "Service role key configured." : "SUPABASE_SERVICE_ROLE_KEY missing: AI metering, rate limits and deletions won't work."} />
                <HealthRow
                  ok={aiReady}
                  label="AI integration"
                  detail={aiReady ? `Anthropic configured · model ${serverEnv.anthropicModel}${serverEnv.anthropicFastMode ? " (fast mode)" : ""}` : "ANTHROPIC_API_KEY not set. AI features show a setup message."}
                />
                <HealthRow ok={settings.ai_enabled} label="AI features switch" detail={settings.ai_enabled ? "Enabled for users." : "Disabled in platform settings."} />
                <HealthRow ok={settings.registration_open} label="Registration" detail={settings.registration_open ? "Open to the public." : "Closed to new sign-ups."} />
                <HealthRow ok={appUrlConfigured} label="Public site URL" detail={appUrlConfigured ? publicEnv.appUrl : "NEXT_PUBLIC_APP_URL not set; email links may point to localhost."} />
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Recent admin activity</CardTitle>
              <Button asChild size="sm" variant="ghost">
                <Link href="/admin/audit-logs">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {audit.data?.length ? (
                <ul className="space-y-2 text-sm">
                  {audit.data.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2">
                      <span className="truncate font-mono text-xs">{a.action}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No administrative actions yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

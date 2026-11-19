import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Clock,
  FileText,
  Flag,
  Handshake,
  ListChecks,
  MessagesSquare,
  PlusCircle,
  ScrollText,
  Upload,
  UserRound,
} from "lucide-react";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { StatusBadge } from "@/components/applications/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Stat } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { getCandidateBundle } from "@/lib/data/profile";
import { computeProfileCompletion } from "@/lib/profile-completion";
import { firstName, formatDate, formatDateTime, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const UPCOMING_ICONS = { interview: CalendarClock, follow_up: Clock, deadline: Flag, next_action: ListChecks } as const;
const UPCOMING_TONES = {
  interview: "bg-coral-50 text-coral-600",
  follow_up: "bg-ocean-50 text-ocean-600",
  deadline: "bg-sun-100 text-sun-700",
  next_action: "bg-grape-50 text-grape-600",
} as const;

export default async function DashboardPage() {
  const { supabase, userId, profile } = await requireUser();
  const [data, bundle] = await Promise.all([getDashboardData(supabase, userId), getCandidateBundle(supabase, userId, profile)]);
  const completion = computeProfileCompletion(bundle);
  const name = firstName(profile.full_name);

  const quickActions = [
    { href: "/dashboard/applications/new", label: "Create New Application", icon: PlusCircle, primary: true },
    { href: "/dashboard/cv", label: "Upload CV", icon: Upload },
    { href: "/dashboard/profile", label: "Edit Profile", icon: UserRound },
    { href: "/dashboard/resumes", label: "Generate Resume", icon: FileText },
    { href: "/dashboard/applications", label: "View Applications", icon: Briefcase },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Welcome back{name ? `, ${name}` : ""}.</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s where your job search stands today.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/applications/new">
            <PlusCircle /> Create New Application
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total applications" value={data.stats.total} icon={Briefcase} tone="grape" />
        <Stat label="In progress" value={data.stats.inProgress} icon={ListChecks} tone="ocean" />
        <Stat label="Interviews scheduled" value={data.stats.interviewsScheduled} icon={CalendarDays} tone="coral" />
        <Stat label="Offers received" value={data.stats.offers} icon={Handshake} tone="mint" />
        <Stat label="Resumes created" value={data.stats.resumes} icon={FileText} tone="bloom" />
        <Stat label="Cover letters" value={data.stats.coverLetters} icon={ScrollText} tone="sun" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Recent applications</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/applications">
                  View all <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className={data.recent.length ? "px-0 pb-2" : undefined}>
              {data.recent.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="No applications yet"
                  description="Paste a job advertisement link to analyse it and create tailored documents."
                  action={
                    <Button asChild size="sm">
                      <Link href="/dashboard/applications/new">Create your first application</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y">
                  {data.recent.map((a) => (
                    <li key={a.id}>
                      <Link href={`/dashboard/applications/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.job_title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[a.company_name, a.location].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <StatusBadge status={a.application_status} className="hidden sm:inline-flex" />
                        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{relativeTime(a.updated_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application activity</CardTitle>
              <CardDescription>Applications saved and submitted per week, last 12 weeks.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityChart data={data.weekly} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming actions</CardTitle>
              <CardDescription>Interviews, follow-ups and deadlines.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled. Add follow-up dates and interviews to your applications to see them here.</p>
              ) : (
                <ul className="space-y-1">
                  {data.upcoming.map((u, i) => {
                    const Icon = UPCOMING_ICONS[u.kind];
                    return (
                      <li key={`${u.href}-${i}`}>
                        <Link href={u.href} className="-mx-2 flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
                          <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${UPCOMING_TONES[u.kind]}`}>
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{u.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.subtitle}</p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {u.kind === "interview" ? formatDateTime(u.date) : formatDate(u.date)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {quickActions.map((q) => (
                <Button key={q.href} asChild variant={q.primary ? "default" : "outline"} className="justify-start">
                  <Link href={q.href}>
                    <q.icon /> {q.label}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile completion</CardTitle>
              <CardDescription>A complete profile produces stronger, more specific documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums">{completion.percent}%</span>
                <span className="text-xs text-muted-foreground">{completion.missing.length} to go</span>
              </div>
              <Progress value={completion.percent} aria-label="Profile completion" />
              {completion.missing.length > 0 ? (
                <ul className="space-y-1 pt-1">
                  {completion.missing.slice(0, 4).map((m) => (
                    <li key={m.key}>
                      <Link href={m.href} className="flex items-center justify-between rounded-md py-1 text-sm text-foreground/85 hover:text-brand">
                        {m.label}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-accent/40">
            <CardContent className="flex items-start gap-3 pt-5">
              <MessagesSquare className="mt-0.5 size-4 shrink-0 text-brand" />
              <p className="text-sm text-foreground/85">
                Invited to interview? Open the application and generate role-specific questions with STAR answers from your experience.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

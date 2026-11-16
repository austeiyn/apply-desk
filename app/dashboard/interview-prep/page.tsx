import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, MessagesSquare } from "lucide-react";
import { StatusBadge } from "@/components/applications/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Interview Preparation" };

export default async function InterviewPrepIndexPage() {
  const { supabase, userId } = await requireUser();
  const [preps, upcoming, candidates] = await Promise.all([
    supabase
      .from("interview_preparations")
      .select("id, application_id, content_json, notes, updated_at, job_applications(job_title, company_name, application_status)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("interviews")
      .select("id, scheduled_at, interview_type, application_id, job_applications(job_title, company_name)")
      .eq("user_id", userId)
      .eq("outcome", "pending")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(10),
    supabase
      .from("job_applications")
      .select("id, job_title, company_name, application_status")
      .eq("user_id", userId)
      .in("application_status", ["screening", "interview", "assessment", "applied"])
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const prepared = new Set((preps.data ?? []).map((p) => p.application_id));
  const suggestions = (candidates.data ?? []).filter((c) => !prepared.has(c.id));
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return (
    <>
      <PageHeader
        title="Interview Preparation"
        description="Role-specific interview questions with suggested answers built from your verified experience, plus your own notes."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {!preps.data?.length ? (
            <EmptyState
              icon={MessagesSquare}
              title="No interview preparation yet"
              description="Open an application and use its Interview prep tab to generate questions and STAR answers."
              action={
                <Button asChild>
                  <Link href="/dashboard/applications">Choose an application</Link>
                </Button>
              }
            />
          ) : (
            preps.data.map((p) => {
              const app = one(p.job_applications);
              const count = ((p.content_json as { questions?: unknown[] })?.questions ?? []).length;
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/applications/${p.application_id}?tab=interview`}
                  className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-brand/40"
                >
                  <MessagesSquare className="size-5 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{app?.job_title ?? "Application"}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {app?.company_name} · {count} questions{p.notes ? " · has notes" : ""} · updated {relativeTime(p.updated_at)}
                    </p>
                  </div>
                  {app ? <StatusBadge status={app.application_status} className="hidden sm:inline-flex" /> : null}
                </Link>
              );
            })
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming interviews</CardTitle>
            </CardHeader>
            <CardContent>
              {!upcoming.data?.length ? (
                <p className="text-sm text-muted-foreground">No upcoming interviews. Add them from an application&apos;s Tracking tab.</p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.data.map((i) => {
                    const app = one(i.job_applications);
                    return (
                      <li key={i.id}>
                        <Link href={`/dashboard/applications/${i.application_id}?tab=interview`} className="-mx-2 flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                          <CalendarClock className="mt-0.5 size-4 text-brand" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{app?.job_title}</span>
                            <span className="block text-xs text-muted-foreground">{formatDateTime(i.scheduled_at)}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
          {suggestions.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Ready to prepare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestions.map((s) => (
                  <Link key={s.id} href={`/dashboard/applications/${s.id}?tab=interview`} className="-mx-2 block rounded-md px-2 py-1.5 hover:bg-muted">
                    <span className="block truncate text-sm font-medium">{s.job_title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.company_name}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

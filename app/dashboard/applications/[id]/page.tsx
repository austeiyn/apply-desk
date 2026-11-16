import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Building2, CalendarClock, ExternalLink, MapPin, Wallet } from "lucide-react";
import { AnalysisPanel } from "@/components/applications/analysis-panel";
import { CoverLetterPanel, ResumePanel } from "@/components/applications/documents-panels";
import { JobDetailsEditor } from "@/components/applications/job-details-editor";
import { StatusSelect } from "@/components/applications/status-select";
import { TrackingPanel } from "@/components/applications/tracking-panel";
import { InterviewPrepPanel } from "@/components/toolkit/interview-prep-panel";
import { ToolkitPanel } from "@/components/toolkit/toolkit-panel";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Button } from "@/components/ui/button";
import type { StoredJobAnalysis } from "@/lib/ai/job-analyser";
import { requireUser } from "@/lib/auth/session";
import { getOwnedApplication } from "@/lib/data/applications";
import { isAiConfigured } from "@/lib/env.server";
import { resumePreferencesSchema } from "@/lib/resume/types";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/dashboard/applications/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const app = await getOwnedApplication(supabase, userId, id);
  return { title: app ? `${app.job_title}${app.company_name ? ` · ${app.company_name}` : ""}` : "Application" };
}

export default async function ApplicationWorkspacePage({ params }: PageProps<"/dashboard/applications/[id]">) {
  const { id } = await params;
  const { supabase, userId, profile } = await requireUser();
  const application = await getOwnedApplication(supabase, userId, id);
  if (!application) notFound();

  const [resumes, letters, interviews, events, prep, materials, candidate] = await Promise.all([
    supabase
      .from("generated_resumes")
      .select("id, title, version, updated_at, origin")
      .eq("user_id", userId)
      .eq("application_id", id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("generated_cover_letters")
      .select("id, title, version, updated_at, origin, tone")
      .eq("user_id", userId)
      .eq("application_id", id)
      .order("updated_at", { ascending: false }),
    supabase.from("interviews").select("*").eq("user_id", userId).eq("application_id", id).order("scheduled_at"),
    supabase.from("application_events").select("*").eq("user_id", userId).eq("application_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("interview_preparations").select("*").eq("user_id", userId).eq("application_id", id).maybeSingle(),
    supabase.from("application_materials").select("*").eq("user_id", userId).eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("candidate_profiles").select("preferences").eq("user_id", userId).single(),
  ]);

  const aiConfigured = isAiConfigured();
  const isAdmin = profile.role === "admin";
  const hasDescription = [application.job_description, application.responsibilities, application.required_skills].join("").trim().length >= 80;
  const savedPrefs = (candidate.data?.preferences as { resume?: unknown } | null)?.resume;
  const defaultPrefs = resumePreferencesSchema.parse(savedPrefs ?? {});

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard/applications">
          <ArrowLeft /> All applications
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{application.job_title}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {application.company_name ? (
              <span className="flex items-center gap-1.5">
                <Building2 className="size-3.5" /> {application.company_name}
              </span>
            ) : null}
            {application.location ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {application.location}
              </span>
            ) : null}
            {application.salary_range ? (
              <span className="flex items-center gap-1.5">
                <Wallet className="size-3.5" /> {application.salary_range}
              </span>
            ) : null}
            {application.deadline ? (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" /> Closes {formatDate(application.deadline)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect applicationId={application.id} status={application.application_status} />
          {application.job_url ? (
            <Button asChild variant="outline">
              <a href={application.job_url} target="_blank" rel="noopener noreferrer nofollow">
                Apply on original listing <ExternalLink />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <Suspense>
        <UrlTabs
          defaultTab="overview"
          tabs={[
            { value: "overview", label: "Job details", content: <JobDetailsEditor application={application} /> },
            {
              value: "analysis",
              label: "Analysis",
              content: (
                <AnalysisPanel
                  applicationId={application.id}
                  analysis={application.job_analysis as unknown as StoredJobAnalysis | null}
                  analysedAt={application.analysis_updated_at}
                  aiConfigured={aiConfigured}
                  isAdmin={isAdmin}
                  hasDescription={hasDescription}
                />
              ),
            },
            {
              value: "resume",
              label: `Resume (${resumes.data?.length ?? 0})`,
              content: (
                <ResumePanel
                  applicationId={application.id}
                  resumes={resumes.data ?? []}
                  aiConfigured={aiConfigured}
                  isAdmin={isAdmin}
                  hasDescription={hasDescription}
                  defaultPrefs={defaultPrefs}
                />
              ),
            },
            {
              value: "cover-letter",
              label: `Cover letter (${letters.data?.length ?? 0})`,
              content: (
                <CoverLetterPanel
                  applicationId={application.id}
                  letters={letters.data ?? []}
                  resumes={resumes.data ?? []}
                  aiConfigured={aiConfigured}
                  isAdmin={isAdmin}
                  hasDescription={hasDescription}
                />
              ),
            },
            {
              value: "interview",
              label: "Interview prep",
              content: <InterviewPrepPanel applicationId={application.id} prep={prep.data} aiConfigured={aiConfigured} isAdmin={isAdmin} hasDescription={hasDescription} />,
            },
            {
              value: "toolkit",
              label: "Toolkit",
              content: <ToolkitPanel application={application} materials={materials.data ?? []} aiConfigured={aiConfigured} isAdmin={isAdmin} hasDescription={hasDescription} />,
            },
            {
              value: "tracking",
              label: "Tracking",
              content: <TrackingPanel application={application} interviews={interviews.data ?? []} events={events.data ?? []} />,
            },
          ]}
        />
      </Suspense>
    </div>
  );
}

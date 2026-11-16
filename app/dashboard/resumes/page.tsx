import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { DownloadMenu } from "@/components/documents/download-menu";
import { NewResumeButton } from "@/components/resume/new-resume-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Resume Library" };

export default async function ResumeLibraryPage() {
  const { supabase, userId } = await requireUser();
  const { data: resumes } = await supabase
    .from("generated_resumes")
    .select("id, title, version, origin, updated_at, application_id, job_applications(job_title, company_name, application_status)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Resume Library"
        description="Every tailored resume you've created. Each is linked to its application and keeps its own version history. Your master CV is never changed."
        actions={<NewResumeButton />}
      />
      {!resumes?.length ? (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="Tailored resumes are generated from an application, so they're written for that specific role."
          action={
            <>
              <Button asChild>
                <Link href="/dashboard/applications/new">Create an application</Link>
              </Button>
              <NewResumeButton variant="outline" />
            </>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resumes.map((r) => {
            const app = Array.isArray(r.job_applications) ? r.job_applications[0] : r.job_applications;
            return (
              <div key={r.id} className="flex flex-col rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(15,26,43,0.04)]">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/resumes/${r.id}`} className="line-clamp-2 font-medium hover:text-brand">
                      {r.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      v{r.version} · updated {relativeTime(r.updated_at)}
                    </p>
                  </div>
                  {r.origin === "ai" ? (
                    <Badge variant="brand">
                      <Sparkles /> AI
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3 flex-1 text-xs text-muted-foreground">
                  {app ? (
                    <Link href={`/dashboard/applications/${r.application_id}`} className="hover:text-brand">
                      For {app.job_title}
                      {app.company_name ? ` at ${app.company_name}` : ""}
                    </Link>
                  ) : (
                    "Not linked to an application"
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/dashboard/resumes/${r.id}`}>Open editor</Link>
                  </Button>
                  <DownloadMenu kind="resume" id={r.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

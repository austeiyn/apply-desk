import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ResumeEditor } from "@/components/resume/resume-editor";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { isAiConfigured } from "@/lib/env.server";
import { ResumeContentSchema } from "@/lib/resume/types";

export const metadata: Metadata = { title: "Resume editor" };

export default async function ResumeEditorPage({ params }: PageProps<"/dashboard/resumes/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, userId } = await requireUser();

  const [{ data: resume }, { data: versions }] = await Promise.all([
    supabase
      .from("generated_resumes")
      .select("id, title, content_json, version, updated_at, application_id, job_applications(job_title, company_name)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("resume_versions").select("version, change_summary, created_at").eq("resume_id", id).eq("user_id", userId).order("version", { ascending: false }).limit(50),
  ]);
  if (!resume) notFound();

  const parsed = ResumeContentSchema.safeParse(resume.content_json);
  const app = Array.isArray(resume.job_applications) ? resume.job_applications[0] : resume.job_applications;

  return (
    <div className="space-y-2">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard/resumes">
          <ArrowLeft /> Resume Library
        </Link>
      </Button>
      {parsed.success ? (
        <ResumeEditor
          resumeId={resume.id}
          initialTitle={resume.title}
          initialContent={parsed.data}
          version={resume.version}
          updatedAt={resume.updated_at}
          versions={versions ?? []}
          aiConfigured={isAiConfigured()}
          application={resume.application_id && app ? { id: resume.application_id, label: [app.job_title, app.company_name].filter(Boolean).join(" · ") } : null}
        />
      ) : (
        <Alert variant="error" title="This resume can't be opened">
          Its stored content is invalid. Restore an earlier version from the version history or create a new resume.
        </Alert>
      )}
    </div>
  );
}

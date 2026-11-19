import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CoverLetterEditor } from "@/components/cover-letter/cover-letter-editor";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { coverLetterStyle } from "@/lib/data/documents";
import type { CoverLetterTone } from "@/lib/constants";
import { isAiConfigured } from "@/lib/env.server";

export const metadata: Metadata = { title: "Cover letter editor" };

export default async function CoverLetterEditorPage({ params }: PageProps<"/dashboard/cover-letters/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, userId, profile } = await requireUser();
  const [{ data: letter }, { data: cp }] = await Promise.all([
    supabase
      .from("generated_cover_letters")
      .select("id, title, content, tone, style, version, updated_at, application_id, job_applications(job_title, company_name)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("candidate_profiles").select("contact_email, phone, location, country").eq("user_id", userId).single(),
  ]);
  if (!letter) notFound();
  const app = Array.isArray(letter.job_applications) ? letter.job_applications[0] : letter.job_applications;
  const style = await coverLetterStyle(supabase, userId, letter);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard/cover-letters">
          <ArrowLeft /> Cover Letters
        </Link>
      </Button>
      <CoverLetterEditor
        letterId={letter.id}
        initial={{ title: letter.title, content: letter.content, tone: letter.tone as CoverLetterTone, style, version: letter.version, updatedAt: letter.updated_at }}
        header={{
          fullName: profile.full_name,
          contact: [[cp?.location, cp?.country].filter(Boolean).join(", "), cp?.phone, cp?.contact_email || profile.email].filter(Boolean).join("  |  "),
          recipient: app?.company_name || null,
        }}
        application={letter.application_id && app ? { id: letter.application_id, label: [app.job_title, app.company_name].filter(Boolean).join(" · ") } : null}
        aiConfigured={isAiConfigured()}
      />
    </div>
  );
}

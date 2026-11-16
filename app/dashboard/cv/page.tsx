import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { CvList } from "@/components/cv/cv-list";
import { CvUploader } from "@/components/cv/cv-uploader";
import { AiSetupNotice } from "@/components/shared/ai-setup-notice";
import { PageHeader } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { isAiConfigured } from "@/lib/env.server";

export const metadata: Metadata = { title: "My CV" };

export default async function CvPage() {
  const { supabase, userId, profile } = await requireUser();
  const { data: cvs } = await supabase
    .from("source_cvs")
    .select("id, file_name, label, mime_type, file_size, version, is_primary, extraction_status, extraction_error, extracted_text, created_at, applied_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const aiConfigured = isAiConfigured();

  return (
    <>
      <PageHeader
        title="My CV"
        description="Your original CVs are your master source documents. Tailored resumes are generated separately and never change these files."
      />
      <div className="space-y-6">
        {!aiConfigured ? <AiSetupNotice isAdmin={profile.role === "admin"} /> : null}
        <CvUploader userId={userId} aiConfigured={aiConfigured} />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Files are stored in private storage that only your account can access.
        </p>
        {cvs && cvs.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Your CV versions</h2>
            <CvList cvs={cvs} aiConfigured={aiConfigured} />
          </section>
        ) : null}
      </div>
    </>
  );
}

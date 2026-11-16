import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CvReview, type CurrentProfileSnapshot } from "@/components/cv/cv-review";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { CvExtractionSchema } from "@/lib/ai/cv-extractor";
import { requireUser } from "@/lib/auth/session";
import { getCandidateBundle } from "@/lib/data/profile";

export const metadata: Metadata = { title: "Review extracted CV" };

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default async function CvReviewPage({ params }: PageProps<"/dashboard/cv/[id]/review">) {
  const { id } = await params;
  const { supabase, userId, profile } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: cv } = await supabase.from("source_cvs").select("id, file_name, parsed_data, extraction_status").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!cv) notFound();

  const parsed = cv.parsed_data ? CvExtractionSchema.safeParse(cv.parsed_data) : null;
  const bundle = await getCandidateBundle(supabase, userId, profile);
  const c = bundle.candidate;

  const current: CurrentProfileSnapshot = {
    personal: {
      full_name: bundle.profile.full_name || null,
      professional_title: c.professional_title,
      email: c.contact_email,
      phone: c.phone,
      city: c.location,
      country: c.country,
      linkedin_url: c.linkedin_url,
      portfolio_url: c.portfolio_url,
      github_url: c.github_url,
      website_url: c.website_url,
    },
    summary: c.professional_summary,
    experienceKeys: bundle.experiences.map((e) => `${norm(e.company)}|${norm(e.job_title)}|${e.start_date?.slice(0, 7) ?? ""}`),
    educationKeys: bundle.education.map((e) => `${norm(e.institution)}|${norm(e.qualification)}`),
    skillNames: bundle.skills.map((s) => s.skill_name.toLowerCase()),
    certificationNames: bundle.certifications.map((x) => norm(x.name)),
    projectTitles: bundle.projects.map((p) => norm(p.title)),
    extraKeys: bundle.extras.map((x) => `${x.kind}|${norm(x.title)}`),
  };

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/dashboard/cv">
          <ArrowLeft /> Back to My CV
        </Link>
      </Button>
      <PageHeader title="Review extracted information" description={`From ${cv.file_name}`} />
      {parsed?.success ? (
        <CvReview cvId={cv.id} data={parsed.data} current={current} />
      ) : (
        <EmptyState
          title="Nothing to review yet"
          description="Extraction hasn't run for this CV, or its results are no longer available. Run it again from My CV."
          action={
            <Button asChild>
              <Link href="/dashboard/cv">Go to My CV</Link>
            </Button>
          }
        />
      )}
    </>
  );
}

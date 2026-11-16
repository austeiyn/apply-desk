import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Upload } from "lucide-react";
import { ExperienceSection, EducationSection } from "@/components/profile/experience-education";
import { CertificationsSection, ExtrasSection, ProjectsSection } from "@/components/profile/other-sections";
import { CareerForm, PersonalForm } from "@/components/profile/profile-forms";
import { UrlTabs } from "@/components/shared/url-tabs";
import { SkillsSection } from "@/components/profile/skills-section";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { getCandidateBundle } from "@/lib/data/profile";
import { computeProfileCompletion } from "@/lib/profile-completion";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const { supabase, userId, profile } = await requireUser();
  const bundle = await getCandidateBundle(supabase, userId, profile);
  const completion = computeProfileCompletion(bundle);

  return (
    <>
      <PageHeader
        title="My Profile"
        description="Your verified career profile is the single source of truth for every resume, cover letter and interview answer we generate."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/cv">
              <Upload /> Import from CV
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Profile {completion.percent}% complete</span>
            {completion.missing[0] ? (
              <Link href={completion.missing[0].href} className="text-brand hover:underline">
                Next: {completion.missing[0].label}
              </Link>
            ) : (
              <span className="text-success">Looking great</span>
            )}
          </div>
          <Progress value={completion.percent} aria-label="Profile completion" />
        </div>
      </div>

      <Suspense>
        <UrlTabs
          defaultTab="personal"
          tabs={[
            { value: "personal", label: "Personal", content: <PersonalForm profile={bundle.profile} candidate={bundle.candidate} /> },
            { value: "career", label: "Career", content: <CareerForm candidate={bundle.candidate} /> },
            { value: "experience", label: `Experience (${bundle.experiences.length})`, content: <ExperienceSection items={bundle.experiences} /> },
            { value: "education", label: `Education (${bundle.education.length})`, content: <EducationSection items={bundle.education} /> },
            { value: "skills", label: `Skills (${bundle.skills.length})`, content: <SkillsSection skills={bundle.skills} /> },
            {
              value: "credentials",
              label: "Certifications & projects",
              content: (
                <>
                  <CertificationsSection items={bundle.certifications} />
                  <ProjectsSection items={bundle.projects} />
                </>
              ),
            },
            { value: "additional", label: "Additional", content: <ExtrasSection items={bundle.extras} /> },
          ]}
        />
      </Suspense>
    </>
  );
}

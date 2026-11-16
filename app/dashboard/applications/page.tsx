import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlusCircle } from "lucide-react";
import { ApplicationsTracker, type TrackerItem } from "@/components/applications/tracker";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Job Applications" };

export default async function ApplicationsPage() {
  const { supabase, userId } = await requireUser();
  const [apps, resumes, letters] = await Promise.all([
    supabase
      .from("job_applications")
      .select("id, job_title, company_name, location, job_url, application_status, deadline, next_action, next_action_date, created_at, updated_at, application_date")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase.from("generated_resumes").select("application_id, version, updated_at").eq("user_id", userId).not("application_id", "is", null),
    supabase.from("generated_cover_letters").select("application_id").eq("user_id", userId).not("application_id", "is", null),
  ]);

  const latestResume = new Map<string, { version: number; updated_at: string }>();
  for (const r of resumes.data ?? []) {
    const prev = latestResume.get(r.application_id!);
    if (!prev || prev.updated_at < r.updated_at) latestResume.set(r.application_id!, { version: r.version, updated_at: r.updated_at });
  }
  const letterCount = new Map<string, number>();
  for (const l of letters.data ?? []) letterCount.set(l.application_id!, (letterCount.get(l.application_id!) ?? 0) + 1);

  const items: TrackerItem[] = (apps.data ?? []).map((a) => ({
    ...a,
    resumeVersion: latestResume.get(a.id)?.version ?? null,
    coverLetters: letterCount.get(a.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Job Applications"
        description="Every role you're interested in or have applied for. Drag cards between columns or change the status on each card."
        actions={
          <Button asChild>
            <Link href="/dashboard/applications/new">
              <PlusCircle /> Create Application
            </Link>
          </Button>
        }
      />
      <Suspense>
        <ApplicationsTracker items={items} />
      </Suspense>
    </>
  );
}

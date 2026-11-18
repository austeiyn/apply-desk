import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { isAiConfigured } from "@/lib/env.server";
import { getApproxLocation } from "@/lib/geo";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const { supabase, userId, profile } = await requireUser({ requireOnboarding: false });
  if (profile.onboarding_completed_at) redirect("/dashboard");
  const { data: candidate } = await supabase.from("candidate_profiles").select("*").eq("user_id", userId).single();
  // Pre-fill city/country from the approximate network location when empty.
  const geo = candidate?.location || candidate?.country ? null : await getApproxLocation();

  return (
    <div className="min-h-dvh">
      <header className="flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
        <Logo href="/onboarding" />
        <form action="/auth/signout" method="post">
          <Button variant="ghost" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <OnboardingWizard
          userId={userId}
          aiConfigured={isAiConfigured()}
          locationDetected={Boolean(geo)}
          defaults={{
            fullName: profile.full_name,
            professionalTitle: candidate?.professional_title ?? "",
            location: candidate?.location ?? geo?.city ?? "",
            country: candidate?.country ?? geo?.country ?? "",
            phone: candidate?.phone ?? "",
          }}
        />
      </main>
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { check, ok, runAction, type ActionResult } from "@/lib/actions";
import { requireActiveUserForAction } from "@/lib/auth/session";
import { onboardingBasicsSchema, onboardingPrefsSchema } from "@/lib/validation/onboarding";

export async function saveOnboardingBasicsAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = onboardingBasicsSchema.parse(input);
    check(await supabase.from("profiles").update({ full_name: v.fullName }).eq("id", userId));
    check(
      await supabase
        .from("candidate_profiles")
        .update({ professional_title: v.professionalTitle, location: v.location, country: v.country, phone: v.phone })
        .eq("user_id", userId),
    );
    return ok(null);
  });
}

export async function completeOnboardingAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const v = onboardingPrefsSchema.parse(input);
    check(
      await supabase
        .from("candidate_profiles")
        .update({
          preferred_job_titles: v.preferredJobTitles,
          work_arrangements: v.workArrangements,
          preferred_employment_types: v.preferredEmploymentTypes,
          preferred_locations: v.preferredLocations,
        })
        .eq("user_id", userId),
    );
    check(await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", userId));
    revalidatePath("/dashboard", "layout");
    return ok(null, "You're all set.");
  });
}

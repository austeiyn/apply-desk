"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { requireActiveUserForAction } from "@/lib/auth/session";
import { uuid } from "@/lib/validation/common";

export async function saveInterviewNotesAction(applicationId: string, notes: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const appId = uuid.parse(applicationId);
    const text = z.string().max(50000, "Notes are limited to 50,000 characters.").parse(notes);
    const { data: existing } = await supabase.from("interview_preparations").select("id").eq("application_id", appId).eq("user_id", userId).maybeSingle();
    if (existing) {
      check(await supabase.from("interview_preparations").update({ notes: text }).eq("id", existing.id).eq("user_id", userId));
    } else {
      // Notes can be kept even before questions are generated.
      check(
        await supabase
          .from("interview_preparations")
          .insert({ user_id: userId, application_id: appId, notes: text, content_json: { questions: [], questions_to_ask: [], preparation_tips: [] } }),
      );
    }
    revalidatePath(`/dashboard/applications/${appId}`);
    revalidatePath("/dashboard/interview-prep");
    return ok(null, "Notes saved.");
  });
}

export async function deleteMaterialAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { supabase, userId } = await requireActiveUserForAction();
    const data = check(await supabase.from("application_materials").delete().eq("id", uuid.parse(id)).eq("user_id", userId).select("application_id"));
    if (!data?.length) return fail("Not found.");
    if (data[0]?.application_id) revalidatePath(`/dashboard/applications/${data[0].application_id}`);
    return ok(null, "Deleted.");
  });
}

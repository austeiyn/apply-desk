import "server-only";

import { parseStyle, type ResumeStyle } from "@/lib/documents/templates";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/** Style of the most recently edited resume for an application, if it has one. */
export async function latestResumeStyle(supabase: ServerSupabaseClient, userId: string, applicationId: string | null): Promise<ResumeStyle | undefined> {
  if (!applicationId) return undefined;
  const { data } = await supabase
    .from("generated_resumes")
    .select("content_json")
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return parseStyle((data?.content_json as { style?: unknown } | null)?.style);
}

/**
 * A cover letter's style: the one saved on the letter, otherwise the style of
 * the application's latest resume (so the pair matches), otherwise Classic.
 */
export async function coverLetterStyle(
  supabase: ServerSupabaseClient,
  userId: string,
  letter: { style: unknown; application_id: string | null },
): Promise<ResumeStyle | undefined> {
  return parseStyle(letter.style) ?? (await latestResumeStyle(supabase, userId, letter.application_id));
}

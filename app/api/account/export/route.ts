import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Download everything stored for the signed-in user as JSON. All reads go
 * through the user's own RLS-scoped client, so it can only ever export the
 * caller's data.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, userId } = session;
  if (!(await rateLimit(`export:${userId}`, 5, 3600))) return Response.json({ error: "Too many exports. Try again later." }, { status: 429 });

  const tables = [
    "candidate_profiles",
    "work_experiences",
    "education",
    "skills",
    "certifications",
    "projects",
    "profile_extras",
    "source_cvs",
    "job_applications",
    "application_events",
    "interviews",
    "generated_resumes",
    "resume_versions",
    "generated_cover_letters",
    "interview_preparations",
    "application_materials",
    "ai_usage",
  ] as const;

  const results = await Promise.all(tables.map((t) => supabase.from(t).select("*").eq("user_id", userId)));
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name, created_at, onboarding_completed_at, last_active_at").eq("id", userId).single();

  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    format: "ApplyDesk data export v1",
    note: "Original CV files are not embedded; download them from My CV. Their extracted text is included under source_cvs.",
    account: profile,
  };
  tables.forEach((t, i) => {
    data[t] = results[i]?.data ?? [];
  });

  const body = JSON.stringify(data, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="applydesk-export-${date}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}

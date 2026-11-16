import "server-only";

import type { ServerSupabaseClient } from "@/lib/supabase/server";

export interface PlatformStats {
  total_users: number;
  total_candidates: number;
  total_admins: number;
  suspended_users: number;
  active_users_7d: number;
  active_users_30d: number;
  new_users_this_month: number;
  new_users_last_month: number;
  onboarded_users: number;
  total_applications: number;
  total_resumes: number;
  total_cover_letters: number;
  total_interview_preps: number;
  total_source_cvs: number;
  total_ai_requests: number;
  ai_requests_30d: number;
  ai_errors_30d: number;
  avg_applications_per_user: number;
}

export async function getPlatformStats(supabase: ServerSupabaseClient): Promise<PlatformStats> {
  const { data, error } = await supabase.rpc("admin_platform_stats");
  if (error) throw error;
  return data as unknown as PlatformStats;
}

export async function getActivitySeries(supabase: ServerSupabaseClient, days: number) {
  const { data, error } = await supabase.rpc("admin_activity_series", { p_days: days });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    day: r.day,
    label: new Date(`${r.day}T00:00:00Z`).toLocaleDateString("en-NZ", { day: "numeric", month: "short", timeZone: "UTC" }),
    registrations: Number(r.registrations),
    applications: Number(r.applications),
    resumes: Number(r.resumes),
    cover_letters: Number(r.cover_letters),
    ai_requests: Number(r.ai_requests),
  }));
}

export function parseDays(value: unknown, fallback = 30): number {
  const n = Number(value);
  return [7, 30, 90, 365].includes(n) ? n : fallback;
}

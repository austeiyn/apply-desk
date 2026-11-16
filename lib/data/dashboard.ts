import "server-only";

import { ACTIVE_STATUSES, type ApplicationStatus } from "@/lib/constants";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export interface UpcomingItem {
  kind: "interview" | "follow_up" | "deadline" | "next_action";
  date: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface WeeklyPoint {
  week: string; // ISO date of the week's Monday
  label: string;
  saved: number;
  submitted: number;
}

function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

/** Bucket timestamps into the last `weeks` ISO weeks (Monday start, UTC). */
export function weeklySeries(created: string[], submitted: string[], weeks = 12, now = new Date()): WeeklyPoint[] {
  const start = mondayOf(now);
  start.setUTCDate(start.getUTCDate() - 7 * (weeks - 1));
  const points: WeeklyPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + 7 * i);
    points.push({
      week: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", timeZone: "UTC" }),
      saved: 0,
      submitted: 0,
    });
  }
  const bucket = (iso: string) => {
    const idx = Math.floor((mondayOf(new Date(iso)).getTime() - start.getTime()) / (7 * 86400_000));
    return idx >= 0 && idx < weeks ? points[idx] : undefined;
  };
  for (const c of created) {
    const p = bucket(c);
    if (p) p.saved++;
  }
  for (const s of submitted) {
    const p = bucket(s);
    if (p) p.submitted++;
  }
  return points;
}

export async function getDashboardData(supabase: ServerSupabaseClient, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const twelveWeeksAgo = new Date(Date.now() - 84 * 86400_000).toISOString();

  const [apps, resumes, letters, interviews, events] = await Promise.all([
    supabase
      .from("job_applications")
      .select("id, job_title, company_name, location, application_status, deadline, follow_up_date, next_action, next_action_date, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase.from("generated_resumes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("generated_cover_letters").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("interviews")
      .select("id, scheduled_at, interview_type, application_id, job_applications(job_title, company_name)")
      .eq("user_id", userId)
      .eq("outcome", "pending")
      .gte("scheduled_at", nowIso)
      .order("scheduled_at")
      .limit(10),
    supabase
      .from("application_events")
      .select("created_at")
      .eq("user_id", userId)
      .eq("event_type", "status_changed")
      .eq("to_status", "applied")
      .gte("created_at", twelveWeeksAgo),
  ]);

  const list = apps.data ?? [];
  const byStatus = (s: ApplicationStatus[]) => list.filter((a) => s.includes(a.application_status as ApplicationStatus)).length;

  const upcoming: UpcomingItem[] = [];
  for (const i of interviews.data ?? []) {
    const job = Array.isArray(i.job_applications) ? i.job_applications[0] : i.job_applications;
    upcoming.push({
      kind: "interview",
      date: i.scheduled_at,
      title: `Interview: ${job?.job_title ?? "Application"}`,
      subtitle: job?.company_name ?? "",
      href: `/dashboard/applications/${i.application_id}?tab=tracking`,
    });
  }
  for (const a of list) {
    const closed = ["rejected", "withdrawn"].includes(a.application_status);
    if (closed) continue;
    if (a.follow_up_date && a.follow_up_date >= today) {
      upcoming.push({ kind: "follow_up", date: a.follow_up_date, title: `Follow up: ${a.job_title}`, subtitle: a.company_name, href: `/dashboard/applications/${a.id}?tab=tracking` });
    }
    if (a.deadline && a.deadline >= today && ["interested", "preparing", "ready"].includes(a.application_status)) {
      upcoming.push({ kind: "deadline", date: a.deadline, title: `Deadline: ${a.job_title}`, subtitle: a.company_name, href: `/dashboard/applications/${a.id}` });
    }
    if (a.next_action && a.next_action_date && a.next_action_date >= today) {
      upcoming.push({ kind: "next_action", date: a.next_action_date, title: a.next_action, subtitle: `${a.job_title} · ${a.company_name}`, href: `/dashboard/applications/${a.id}?tab=tracking` });
    }
  }
  upcoming.sort((x, y) => x.date.localeCompare(y.date));

  return {
    stats: {
      total: list.length,
      inProgress: byStatus(ACTIVE_STATUSES),
      interviewsScheduled: (interviews.data ?? []).length,
      offers: byStatus(["offer"]),
      resumes: resumes.count ?? 0,
      coverLetters: letters.count ?? 0,
    },
    recent: list.slice(0, 5),
    upcoming: upcoming.slice(0, 8),
    weekly: weeklySeries(
      list.map((a) => a.created_at),
      (events.data ?? []).map((e) => e.created_at),
    ),
  };
}

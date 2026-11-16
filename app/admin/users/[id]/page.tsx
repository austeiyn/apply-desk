import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Lock, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/applications/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, Stat, Table, TBody, TD, TH, THead, TR } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/session";
import { formatDate, formatDateTime, relativeTime } from "@/lib/utils";
import { UserAdminActions } from "./user-admin-actions";

export const metadata: Metadata = { title: "User details" };

export default async function AdminUserDetailPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, userId } = await requireAdmin();

  const { data: user } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, account_status, status_reason, status_changed_at, created_at, last_active_at, onboarding_completed_at, support_access_expires_at")
    .eq("id", id)
    .maybeSingle();
  if (!user) notFound();

  const [{ data: counts }, { data: audit }] = await Promise.all([
    supabase.rpc("admin_list_users", { p_search: user.email, p_limit: 100 }),
    supabase.from("audit_logs").select("id, action, actor_email, metadata, created_at").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const c = counts?.find((r) => r.id === id);

  const supportActive = Boolean(user.support_access_expires_at && new Date(user.support_access_expires_at) > new Date());
  const showSupport = supportActive && sp.support === "1";
  let support: {
    candidate: { professional_title: string | null; location: string | null; country: string | null } | null;
    applications: Array<{ id: string; job_title: string; company_name: string; application_status: string; updated_at: string }>;
    resumes: number;
    letters: number;
  } | null = null;

  if (showSupport) {
    // RLS only returns rows while the user's support grant is active.
    await supabase.rpc("admin_log_action", { p_action: "support.viewed", p_target_type: "user", p_target_id: id, p_metadata: {} });
    const [cand, apps, res, let_] = await Promise.all([
      supabase.from("candidate_profiles").select("professional_title, location, country").eq("user_id", id).maybeSingle(),
      supabase.from("job_applications").select("id, job_title, company_name, application_status, updated_at").eq("user_id", id).order("updated_at", { ascending: false }).limit(50),
      supabase.from("generated_resumes").select("id", { count: "exact", head: true }).eq("user_id", id),
      supabase.from("generated_cover_letters").select("id", { count: "exact", head: true }).eq("user_id", id),
    ]);
    support = { candidate: cand.data, applications: apps.data ?? [], resumes: res.count ?? 0, letters: let_.count ?? 0 };
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/users">
          <ArrowLeft /> All users
        </Link>
      </Button>
      <PageHeader
        title={user.full_name || user.email}
        description={user.email}
        actions={
          user.id !== userId && user.role !== "admin" ? (
            <UserAdminActions userId={user.id} email={user.email} status={user.account_status as "active" | "suspended"} />
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        {user.account_status === "suspended" ? <Badge variant="danger">Suspended</Badge> : <Badge variant="success">Active</Badge>}
        {user.role === "admin" ? (
          <Badge variant="info">
            <ShieldCheck /> Administrator
          </Badge>
        ) : (
          <Badge>Candidate</Badge>
        )}
        {user.onboarding_completed_at ? <Badge variant="outline">Onboarded</Badge> : <Badge variant="warning">Onboarding incomplete</Badge>}
      </div>

      {user.account_status === "suspended" ? (
        <Alert variant="warning" title="Account suspended">
          {user.status_reason ? `Reason: ${user.status_reason}. ` : ""}
          {user.status_changed_at ? `Since ${formatDateTime(user.status_changed_at)}.` : ""}
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registered" value={formatDate(user.created_at)} />
        <Stat label="Last active" value={user.last_active_at ? relativeTime(user.last_active_at) : "Never"} />
        <Stat label="Applications" value={Number(c?.application_count ?? 0)} />
        <Stat label="Documents generated" value={Number(c?.document_count ?? 0)} hint={`${Number(c?.ai_request_count ?? 0)} AI requests`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {supportActive ? <Eye className="size-4 text-warning" /> : <Lock className="size-4 text-muted-foreground" />} Support access
          </CardTitle>
          <CardDescription>
            {supportActive
              ? `The user has granted temporary read-only access until ${formatDateTime(user.support_access_expires_at)}. Opening it is recorded in the audit log.`
              : "This user's profile, CVs, documents and notes are private. They can grant temporary read-only access from their settings if they need help."}
          </CardDescription>
        </CardHeader>
        {supportActive ? (
          <CardContent className="space-y-4">
            {!showSupport ? (
              <Button asChild variant="outline">
                <Link href={`/admin/users/${id}?support=1`}>Open read-only support view</Link>
              </Button>
            ) : support ? (
              <div className="space-y-4">
                <p className="text-sm">
                  <span className="font-medium">{support.candidate?.professional_title ?? "No title"}</span>
                  {support.candidate?.location ? ` · ${[support.candidate.location, support.candidate.country].filter(Boolean).join(", ")}` : ""} · {support.resumes} resumes ·{" "}
                  {support.letters} cover letters
                </p>
                <div className="rounded-lg border">
                  <Table>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH className="pl-3">Application</TH>
                        <TH>Status</TH>
                        <TH className="pr-3">Updated</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {support.applications.map((a) => (
                        <TR key={a.id}>
                          <TD className="pl-3">
                            {a.job_title}
                            <span className="text-muted-foreground"> · {a.company_name}</span>
                          </TD>
                          <TD>
                            <StatusBadge status={a.application_status} />
                          </TD>
                          <TD className="pr-3 text-muted-foreground">{relativeTime(a.updated_at)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit history for this account</CardTitle>
        </CardHeader>
        <CardContent>
          {audit?.length ? (
            <ul className="divide-y text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="font-mono text-xs">{a.action}</span>
                    <span className="text-muted-foreground"> by {a.actor_email ?? "system"}</span>
                    {(a.metadata as { reason?: string })?.reason ? <span className="text-muted-foreground"> · {(a.metadata as { reason?: string }).reason}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No administrative actions recorded for this account.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

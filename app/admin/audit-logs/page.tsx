import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Table, TBody, TD, TH, THead, TR } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit Logs" };

const PAGE_SIZE = 50;
const ACTIONS = [
  "user.suspended",
  "user.reactivated",
  "user.deleted",
  "support.viewed",
  "settings.updated",
  "announcement.created",
  "announcement.updated",
  "announcement.deleted",
  "admin.role_granted",
  "admin.role_revoked",
];

function describeMetadata(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  return Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ")
    .slice(0, 200);
}

export default async function AuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const action = typeof sp.action === "string" && ACTIONS.includes(sp.action) ? sp.action : "";
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase
    .from("audit_logs")
    .select("id, action, actor_email, actor_user_id, target_type, target_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (action) query = query.eq("action", action);
  const { data, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: number, a = action) => `/admin/audit-logs?${new URLSearchParams({ ...(a ? { action: a } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;

  return (
    <>
      <PageHeader title="Audit Logs" description="An append-only record of sensitive administrative actions. Entries can't be edited or deleted." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Button asChild size="sm" variant={action ? "ghost" : "secondary"}>
          <Link href={href(1, "")}>All</Link>
        </Button>
        {ACTIONS.map((a) => (
          <Button key={a} asChild size="sm" variant={action === a ? "secondary" : "ghost"}>
            <Link href={href(1, a)} className="font-mono text-xs">
              {a}
            </Link>
          </Button>
        ))}
      </div>
      {!data?.length ? (
        <EmptyState title="No audit entries" description="Administrative actions will appear here." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="pl-4">When</TH>
                <TH>Action</TH>
                <TH>Actor</TH>
                <TH>Target</TH>
                <TH className="pr-4">Details</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap pl-4 text-muted-foreground">{formatDateTime(r.created_at)}</TD>
                  <TD className="font-mono text-xs">{r.action}</TD>
                  <TD className="max-w-48 truncate">{r.actor_email ?? (r.actor_user_id ? "Deleted admin" : "System / SQL")}</TD>
                  <TD className="max-w-56 truncate text-xs">
                    {r.target_type === "user" && r.target_id ? (
                      <Link href={`/admin/users/${r.target_id}`} className="font-mono text-brand hover:underline">
                        user:{r.target_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="font-mono">{[r.target_type, r.target_id?.slice(0, 24)].filter(Boolean).join(":")}</span>
                    )}
                  </TD>
                  <TD className="max-w-80 truncate pr-4 text-xs text-muted-foreground">{describeMetadata(r.metadata)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1}>
              Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href={href(Math.min(pages, page + 1))} aria-disabled={page >= pages}>
              Next
            </Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}

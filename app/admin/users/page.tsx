import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/session";
import { UserDirectory, type DirectoryUser } from "./user-directory";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 25;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const dateParam = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { supabase, userId } = await requireAdmin();
  const sp = await searchParams;
  const q = (one(sp.q) ?? "").slice(0, 100);
  const status = ["active", "suspended", "admin"].includes(one(sp.status) ?? "") ? one(sp.status)! : "";
  const from = dateParam(one(sp.from));
  const to = dateParam(one(sp.to));
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: q || undefined,
    p_status: status || undefined,
    p_created_from: from ?? undefined,
    p_created_to: to ?? undefined,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const users: DirectoryUser[] = (data ?? []).map((u) => ({ ...u, application_count: Number(u.application_count), document_count: Number(u.document_count), ai_request_count: Number(u.ai_request_count) }));
  const total = Number(data?.[0]?.total_count ?? 0);

  return (
    <>
      <PageHeader title="Users" description="Search and manage accounts. Only account details and activity counts are shown; candidates' private content is not accessible." />
      <UserDirectory users={users} total={total} page={page} pageSize={PAGE_SIZE} filters={{ q, status, from: from ?? "", to: to ?? "" }} currentAdminId={userId} />
    </>
  );
}

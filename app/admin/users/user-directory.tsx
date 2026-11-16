"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Search, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import { deleteUserAction, setAccountStatusAction } from "@/app/admin/actions";
import { useAction } from "@/components/shared/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/feedback";
import { Field } from "@/components/ui/form-controls";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/misc";
import { formatDate, relativeTime } from "@/lib/utils";

export interface DirectoryUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  account_status: string;
  status_reason: string | null;
  created_at: string;
  last_active_at: string | null;
  onboarding_completed_at: string | null;
  support_access_expires_at: string | null;
  application_count: number;
  document_count: number;
  ai_request_count: number;
}

type DialogState = { kind: "suspend" | "delete"; user: DirectoryUser } | null;

export function UserDirectory({
  users,
  total,
  page,
  pageSize,
  filters,
  currentAdminId,
}: {
  users: DirectoryUser[];
  total: number;
  page: number;
  pageSize: number;
  filters: { q: string; status: string; from: string; to: string };
  currentAdminId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(filters.q);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reason, setReason] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const status = useAction(setAccountStatusAction, {
    onSuccess: () => {
      setDialog(null);
      router.refresh();
    },
  });
  const remove = useAction(deleteUserAction, {
    onSuccess: () => {
      setDialog(null);
      router.refresh();
    },
  });

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const openDialog = (kind: "suspend" | "delete", user: DirectoryUser) => {
    setReason("");
    setConfirmEmail("");
    setDialog({ kind, user });
  };

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1fr_160px_150px_150px_auto] lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() });
        }}
      >
        <Field label="Search" htmlFor="user-search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="user-search" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
        </Field>
        <Field label="Status" htmlFor="user-status">
          <NativeSelect id="user-status" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All accounts</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="admin">Administrators</option>
          </NativeSelect>
        </Field>
        <Field label="Registered from" htmlFor="user-from">
          <Input id="user-from" type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
        </Field>
        <Field label="Registered to" htmlFor="user-to">
          <Input id="user-to" type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} />
        </Field>
        <Button type="submit">Search</Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {total} account{total === 1 ? "" : "s"}
      </p>

      {users.length === 0 ? (
        <EmptyState title="No accounts match" description="Try a different search or clear the filters." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="pl-4">User</TH>
                <TH>Status</TH>
                <TH>Registered</TH>
                <TH>Last active</TH>
                <TH className="text-right">Applications</TH>
                <TH className="text-right">Documents</TH>
                <TH className="text-right">AI requests</TH>
                <TH className="pr-4 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {users.map((u) => (
                <TR key={u.id}>
                  <TD className="max-w-64 pl-4">
                    <Link href={`/admin/users/${u.id}`} className="block truncate font-medium hover:text-brand">
                      {u.full_name || "—"}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {u.account_status === "suspended" ? <Badge variant="danger">Suspended</Badge> : <Badge variant="success">Active</Badge>}
                      {u.role === "admin" ? (
                        <Badge variant="info">
                          <ShieldCheck /> Admin
                        </Badge>
                      ) : null}
                      {!u.onboarding_completed_at ? <Badge variant="outline">Onboarding</Badge> : null}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDate(u.created_at)}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{u.last_active_at ? relativeTime(u.last_active_at) : "Never"}</TD>
                  <TD className="text-right tabular-nums">{u.application_count}</TD>
                  <TD className="text-right tabular-nums">{u.document_count}</TD>
                  <TD className="text-right tabular-nums">{u.ai_request_count}</TD>
                  <TD className="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${u.email}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/users/${u.id}`}>View details</Link>
                        </DropdownMenuItem>
                        {u.id !== currentAdminId && u.role !== "admin" ? (
                          <>
                            <DropdownMenuSeparator />
                            {u.account_status === "active" ? (
                              <DropdownMenuItem onSelect={() => openDialog("suspend", u)}>
                                <UserX /> Suspend account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => status.run(u.id, "active")}>
                                <UserCheck /> Reactivate account
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem destructive onSelect={() => openDialog("delete", u)}>
                              <Trash2 /> Delete account
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
            Next
          </Button>
        </div>
      ) : null}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          {dialog?.kind === "suspend" ? (
            <>
              <DialogHeader>
                <DialogTitle>Suspend {dialog.user.email}?</DialogTitle>
                <DialogDescription>They&apos;ll be signed out and lose access to their workspace until reactivated. Their data is kept.</DialogDescription>
              </DialogHeader>
              <Field label="Reason (recorded in the audit log)" htmlFor="suspend-reason">
                <Textarea id="suspend-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" loading={status.pending} onClick={() => status.run(dialog.user.id, "suspended", reason)}>
                  Suspend account
                </Button>
              </DialogFooter>
            </>
          ) : dialog?.kind === "delete" ? (
            <>
              <DialogHeader>
                <DialogTitle>Permanently delete this account?</DialogTitle>
                <DialogDescription>
                  Deletes the account, all of the user&apos;s data and files. Only do this when the user has requested deletion or under your data-retention policy.
                </DialogDescription>
              </DialogHeader>
              {remove.error ? <Alert variant="error">{remove.error}</Alert> : null}
              <Field label="Reason (recorded in the audit log)" htmlFor="delete-reason">
                <Textarea id="delete-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. User requested deletion by email on 3 May" />
              </Field>
              <Field label={`Type ${dialog.user.email} to confirm`} htmlFor="delete-confirm">
                <Input id="delete-confirm" autoComplete="off" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  loading={remove.pending}
                  disabled={confirmEmail.trim().toLowerCase() !== dialog.user.email.toLowerCase()}
                  onClick={() => remove.run(dialog.user.id, { confirmEmail, reason })}
                >
                  Delete permanently
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserCheck, UserX } from "lucide-react";
import { deleteUserAction, setAccountStatusAction } from "@/app/admin/actions";
import { useAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/form-controls";
import { Input, Textarea } from "@/components/ui/input";

export function UserAdminActions({ userId, email, status }: { userId: string; email: string; status: "active" | "suspended" }) {
  const router = useRouter();
  const [mode, setMode] = useState<"suspend" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const setStatus = useAction(setAccountStatusAction, {
    onSuccess: () => {
      setMode(null);
      router.refresh();
    },
  });
  const remove = useAction(deleteUserAction, { onSuccess: () => router.push("/admin/users") });

  return (
    <>
      {status === "active" ? (
        <Button variant="outline" onClick={() => setMode("suspend")}>
          <UserX /> Suspend
        </Button>
      ) : (
        <Button variant="outline" loading={setStatus.pending} onClick={() => setStatus.run(userId, "active")}>
          <UserCheck /> Reactivate
        </Button>
      )}
      <Button variant="ghost" className="text-destructive hover:bg-rose-50 hover:text-destructive" onClick={() => setMode("delete")}>
        <Trash2 /> Delete
      </Button>
      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "suspend" ? `Suspend ${email}?` : "Permanently delete this account?"}</DialogTitle>
            <DialogDescription>
              {mode === "suspend"
                ? "They'll be signed out and lose access until reactivated. Their data is kept."
                : "Deletes the account, all data and files. Only when requested by the user or required by your retention policy."}
            </DialogDescription>
          </DialogHeader>
          {remove.error && mode === "delete" ? <Alert variant="error">{remove.error}</Alert> : null}
          <Field label="Reason (recorded in the audit log)" htmlFor="admin-reason">
            <Textarea id="admin-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {mode === "delete" ? (
            <Field label={`Type ${email} to confirm`} htmlFor="admin-confirm">
              <Input id="admin-confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            {mode === "suspend" ? (
              <Button variant="destructive" loading={setStatus.pending} onClick={() => setStatus.run(userId, "suspended", reason)}>
                Suspend account
              </Button>
            ) : (
              <Button
                variant="destructive"
                loading={remove.pending}
                disabled={confirm.trim().toLowerCase() !== email.toLowerCase()}
                onClick={() => remove.run(userId, { confirmEmail: confirm, reason })}
              >
                Delete permanently
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

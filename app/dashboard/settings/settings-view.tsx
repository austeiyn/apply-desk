"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Download, LifeBuoy, ShieldCheck, Trash2 } from "lucide-react";
import { useAction, useFormAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/form-controls";
import { Input, NativeSelect } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";
import { changeEmailAction, changePasswordAction, deleteMyAccountAction, setSupportAccessAction } from "./actions";

interface Quota {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{limit > 0 ? `${used} of ${limit}` : `${used} (no limit)`}</span>
      </div>
      <Progress value={pct} aria-label={`${label} usage`} indicatorClassName={pct >= 90 ? "bg-destructive" : undefined} />
    </div>
  );
}

export function SettingsView({
  email,
  isAdmin,
  supportAccessUntil,
  quota,
  aiAvailable,
  supportEmail,
}: {
  email: string;
  isAdmin: boolean;
  supportAccessUntil: string | null;
  quota: Quota | null;
  aiAvailable: boolean;
  supportEmail: string;
}) {
  const router = useRouter();
  const emailForm = useForm<{ email: string }>({ defaultValues: { email: "" } });
  const emailAction = useFormAction(emailForm, changeEmailAction, { onSuccess: () => emailForm.reset() });
  const pwForm = useForm<{ currentPassword: string; password: string; confirmPassword: string }>({
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });
  const pwAction = useFormAction(pwForm, changePasswordAction, { onSuccess: () => pwForm.reset() });
  const [hours, setHours] = useState("72");
  const support = useAction(setSupportAccessAction, { onSuccess: () => router.refresh() });
  const supportActive = supportAccessUntil && new Date(supportAccessUntil) > new Date();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteForm = useForm<{ password: string; confirm: string }>({ defaultValues: { password: "", confirm: "" } });
  const deleteAction = useFormAction(deleteForm, deleteMyAccountAction, {
    onSuccess: () => {
      router.replace("/?deleted=1");
      router.refresh();
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <form onSubmit={emailAction.onSubmit} noValidate>
          <CardHeader>
            <CardTitle>Email address</CardTitle>
            <CardDescription>
              Signed in as <span className="font-medium text-foreground">{email}</span>. Changing it requires confirmation from both addresses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="New email address" htmlFor="newEmail" error={emailForm.formState.errors.email?.message}>
              <Input id="newEmail" type="email" autoComplete="email" {...emailForm.register("email")} />
            </Field>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={emailAction.pending}>
              Change email
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <form onSubmit={pwAction.onSubmit} noValidate>
          <CardHeader>
            <CardTitle>Password</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Current password" htmlFor="currentPassword" error={pwForm.formState.errors.currentPassword?.message}>
              <Input id="currentPassword" type="password" autoComplete="current-password" {...pwForm.register("currentPassword")} />
            </Field>
            <Field label="New password" htmlFor="newPassword" error={pwForm.formState.errors.password?.message} description="At least 8 characters with a letter and a number.">
              <Input id="newPassword" type="password" autoComplete="new-password" {...pwForm.register("password")} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirmNewPassword" error={pwForm.formState.errors.confirmPassword?.message}>
              <Input id="confirmNewPassword" type="password" autoComplete="new-password" {...pwForm.register("confirmPassword")} />
            </Field>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={pwAction.pending}>
              Update password
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI usage</CardTitle>
          <CardDescription>Limits keep the platform sustainable. Requests that fail aren&apos;t counted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!aiAvailable ? <Alert variant="neutral">AI features are currently unavailable on this platform.</Alert> : null}
          {quota ? (
            <>
              <UsageBar label="Last 24 hours" used={quota.dailyUsed} limit={quota.dailyLimit} />
              <UsageBar label="Last 30 days" used={quota.monthlyUsed} limit={quota.monthlyLimit} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Usage information is unavailable.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="size-4 text-brand" /> Support access
          </CardTitle>
          <CardDescription>
            Administrators can&apos;t see your profile, CVs, documents or notes. If you need help, you can grant temporary read-only access. It expires
            automatically and every view is audit-logged.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {supportActive ? (
            <Alert variant="warning" title="Support access is on">
              Read-only access is granted until {formatDateTime(supportAccessUntil)}.
            </Alert>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-success" /> Your workspace is private.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {supportActive ? (
              <Button variant="outline" onClick={() => support.run(null)} loading={support.pending}>
                Revoke access now
              </Button>
            ) : (
              <>
                <NativeSelect aria-label="Support access duration" value={hours} onChange={(e) => setHours(e.target.value)} className="w-40">
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                </NativeSelect>
                <Button variant="outline" onClick={() => support.run(Number(hours))} loading={support.pending}>
                  Grant support access
                </Button>
              </>
            )}
          </div>
          {supportEmail ? (
            <p className="text-xs text-muted-foreground">
              Support contact:{" "}
              <a href={`mailto:${supportEmail}`} className="text-brand underline">
                {supportEmail}
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export your data</CardTitle>
          <CardDescription>Download everything stored in your account as a JSON file: profile, applications, documents and their versions, notes and usage.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <a href="/api/account/export" download>
              <Download /> Download my data
            </a>
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            Permanently delete your account, profile, CV files, applications, resumes, cover letters and notes. This can&apos;t be undone. Consider exporting your data first.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={isAdmin}>
            <Trash2 /> Delete my account
          </Button>
          {isAdmin ? <p className="text-xs text-muted-foreground">Administrator accounts must be demoted before deletion.</p> : null}
        </CardFooter>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account permanently?</DialogTitle>
            <DialogDescription>All of your data and files will be erased immediately.</DialogDescription>
          </DialogHeader>
          <form onSubmit={deleteAction.onSubmit} className="space-y-3" noValidate>
            {deleteAction.error ? <Alert variant="error">{deleteAction.error}</Alert> : null}
            <Field label="Your password" htmlFor="deletePassword" error={deleteForm.formState.errors.password?.message}>
              <Input id="deletePassword" type="password" autoComplete="current-password" {...deleteForm.register("password")} />
            </Field>
            <Field label='Type "DELETE" to confirm' htmlFor="deleteConfirm" error={deleteForm.formState.errors.confirm?.message}>
              <Input id="deleteConfirm" autoComplete="off" {...deleteForm.register("confirm")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" loading={deleteAction.pending}>
                Delete everything
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

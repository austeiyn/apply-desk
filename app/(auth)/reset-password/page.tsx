import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { getSession } from "@/lib/auth/session";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const session = await getSession();
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Use at least 8 characters, including a letter and a number.</p>
      </div>
      {session ? (
        <ResetPasswordForm />
      ) : (
        <Alert variant="warning" title="This reset link has expired">
          Password reset links can only be used once and expire after an hour.{" "}
          <Link href="/forgot-password" className="font-medium underline">
            Request a new link
          </Link>
          .
        </Alert>
      )}
    </div>
  );
}

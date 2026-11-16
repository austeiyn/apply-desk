import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ResendButton } from "./resend-button";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <MailCheck className="size-6" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a verification link to{" "}
          {email ? <span className="font-medium text-foreground">{email}</span> : "your email address"}. Click the link to
          confirm your account and start setting up your profile.
        </p>
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-4 text-left text-sm text-muted-foreground">
        <p>Didn&apos;t get it? Check your spam folder, or request a new link.</p>
        {email ? <ResendButton email={email} /> : null}
      </div>
      <Link href="/login" className="text-sm font-medium text-brand hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { getPlatformSettings } from "@/lib/settings";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const settings = await getPlatformSettings();
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Free to start. It takes less than a minute.</p>
      </div>
      {settings.registration_open ? (
        <RegisterForm />
      ) : (
        <Alert variant="warning" title="Registration is paused">
          We&apos;re not accepting new accounts right now. Please check back soon.
        </Alert>
      )}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

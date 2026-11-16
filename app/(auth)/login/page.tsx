import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link_invalid: "That verification link is invalid or has expired. Sign in to request a new one.",
  reset_link_invalid: "That password reset link is invalid or has expired. Request a new one below.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const verified = params.verified === "1";

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue your job search.</p>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {verified ? <Alert variant="success">Your email is confirmed. Sign in to get started.</Alert> : null}
      <LoginForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        New to ApplyDesk?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

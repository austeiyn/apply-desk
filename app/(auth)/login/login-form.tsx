"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { applyFieldErrors } from "@/lib/forms";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { loginAction, resendVerificationAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", next } });
  const { register, handleSubmit, formState, setError: setFieldError, getValues } = form;

  const onSubmit = handleSubmit((values) => {
    setError(null);
    setUnconfirmed(false);
    startTransition(async () => {
      const result = await loginAction({ ...values, next });
      if (result && !result.ok) {
        setError(result.error);
        setUnconfirmed(Boolean(result.fieldErrors?._unconfirmed));
        applyFieldErrors(setFieldError, result.fieldErrors);
      }
    });
  });

  const resend = () =>
    startTransition(async () => {
      const result = await resendVerificationAction(getValues("email"));
      if (result.ok) toast.success(result.message ?? "Verification email sent.");
      else toast.error(result.error);
    });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert
          variant="error"
          action={
            unconfirmed ? (
              <Button type="button" size="sm" variant="outline" onClick={resend} disabled={pending}>
                Resend link
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      ) : null}
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Field
        label={
          <span className="flex w-full items-center justify-between">
            Password
            <Link href="/forgot-password" className="text-xs font-normal text-brand hover:underline">
              Forgot password?
            </Link>
          </span>
        }
        htmlFor="password"
        error={formState.errors.password?.message}
      >
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register("password")} />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}

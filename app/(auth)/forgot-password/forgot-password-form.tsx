"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { forgotPasswordAction } from "../actions";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  });

  if (sent) {
    return (
      <Alert variant="success" title="Check your email">
        If an account exists for that address, you&apos;ll receive a password reset link shortly. The link expires in one hour.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}

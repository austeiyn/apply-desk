"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { applyFieldErrors } from "@/lib/forms";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPasswordAction } from "../actions";

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<z.input<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (result.ok) {
        toast.success("Password updated.");
        router.replace("/dashboard");
      } else {
        setError(result.error);
        applyFieldErrors(setFieldError, result.fieldErrors);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Field label="New password" htmlFor="password" error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register("password")} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={formState.errors.confirmPassword?.message}>
        <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.confirmPassword} {...register("confirmPassword")} />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Update password
      </Button>
    </form>
  );
}

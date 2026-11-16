"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { applyFieldErrors } from "@/lib/forms";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { registerAction } from "../actions";

export function RegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, control, setError: setFieldError } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", acceptTerms: false as unknown as true },
  });
  const errors = formState.errors;

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await registerAction(values);
      if (result.ok) {
        router.push(`/verify-email?email=${encodeURIComponent(result.data.email)}`);
      } else {
        setError(result.error);
        applyFieldErrors(setFieldError, result.fieldErrors);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message} description="At least 8 characters, including a letter and a number.">
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
        <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
      </Field>
      <div className="space-y-1">
        <div className="flex items-start gap-2.5">
          <Controller
            control={control}
            name="acceptTerms"
            render={({ field }) => (
              <Checkbox
                id="acceptTerms"
                className="mt-0.5"
                checked={field.value === true}
                onCheckedChange={(v) => field.onChange(v === true)}
                aria-invalid={!!errors.acceptTerms}
              />
            )}
          />
          <label htmlFor="acceptTerms" className="text-sm leading-snug text-muted-foreground">
            I agree to the{" "}
            <Link href="/terms" className="text-brand hover:underline" target="_blank">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-brand hover:underline" target="_blank">
              Privacy Policy
            </Link>
            .
          </label>
        </div>
        {errors.acceptTerms ? <p className="text-xs font-medium text-destructive">{errors.acceptTerms.message}</p> : null}
      </div>
      <Button type="submit" className="w-full" loading={pending}>
        Create account
      </Button>
    </form>
  );
}

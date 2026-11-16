"use client";

import { useCallback, useState, useTransition } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { toast } from "@/components/ui/sonner";
import { applyFieldErrors } from "@/lib/forms";

type Result<T> = { ok: true; data: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

interface Options<T> {
  onSuccess?: (data: T) => void;
  /** Show a toast with the server's success message (default true). */
  toastSuccess?: boolean;
}

/** Run a server action from a client component with pending/toast/error handling. */
export function useAction<TArgs extends unknown[], T>(
  action: (...args: TArgs) => Promise<Result<T>>,
  options: Options<T> = {},
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (...args: TArgs) =>
      new Promise<Result<T>>((resolve) => {
        setError(null);
        startTransition(async () => {
          try {
            const result = await action(...args);
            if (result.ok) {
              if (options.toastSuccess !== false && result.message) toast.success(result.message);
              options.onSuccess?.(result.data);
            } else {
              setError(result.error);
              toast.error(result.error);
            }
            resolve(result);
          } catch {
            const message = "Something went wrong. Check your connection and try again.";
            setError(message);
            toast.error(message);
            resolve({ ok: false, error: message });
          }
        });
      }),
    [action, options],
  );

  return { run, pending, error, setError };
}

/** Submit a react-hook-form through a server action, mapping field errors back onto the form. */
export function useFormAction<TValues extends FieldValues, T>(
  form: UseFormReturn<TValues>,
  action: (values: TValues) => Promise<Result<T>>,
  options: Options<T> = {},
) {
  const { run, pending, error } = useAction(action, options);
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run(values);
    if (!result.ok) applyFieldErrors(form.setError, result.fieldErrors);
  });
  return { onSubmit, pending, error };
}

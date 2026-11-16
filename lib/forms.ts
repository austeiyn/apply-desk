import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Apply server-side field errors (from ActionResult) to a react-hook-form instance. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string[]> | undefined,
): void {
  if (!fieldErrors) return;
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (key.startsWith("_") || !messages?.[0]) continue;
    setError(key as Path<T>, { type: "server", message: messages[0] });
  }
}

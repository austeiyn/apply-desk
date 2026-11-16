"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { resendVerificationAction } from "../actions";

export function ResendButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await resendVerificationAction(email);
          if (result.ok) toast.success(result.message ?? "Verification email sent.");
          else toast.error(result.error);
        })
      }
    >
      Resend verification email
    </Button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { createResumeFromProfileAction } from "@/app/dashboard/documents/actions";
import { useAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";

/** Create a general (untailored) resume from the profile, without AI. */
export function NewResumeButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const { run, pending } = useAction(createResumeFromProfileAction, { onSuccess: (d) => router.push(`/dashboard/resumes/${d.id}`) });
  return (
    <Button variant={variant} onClick={() => run(null)} loading={pending}>
      <FilePlus2 /> New resume from profile
    </Button>
  );
}

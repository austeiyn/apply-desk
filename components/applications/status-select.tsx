"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStatusAction } from "@/app/dashboard/applications/actions";
import { NativeSelect } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { APPLICATION_STATUSES, STATUS_META, type ApplicationStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Explicit, user-confirmed status change. Nothing changes status automatically. */
export function StatusSelect({ applicationId, status, className }: { applicationId: string; status: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(status);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("size-2 rounded-full", STATUS_META[optimistic as ApplicationStatus]?.dot ?? "bg-slate-400")} aria-hidden />
      <NativeSelect
        aria-label="Application status"
        className="h-9 w-48"
        value={optimistic}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            setOptimistic(next);
            const res = await updateStatusAction(applicationId, next);
            if (res.ok) {
              toast.success(`Status updated to ${STATUS_META[next as ApplicationStatus].label}.`);
              router.refresh();
            } else toast.error(res.error);
          });
        }}
      >
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

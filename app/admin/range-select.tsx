"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/input";

export function RangeSelect({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <NativeSelect
      aria-label="Time range"
      className="w-40"
      value={String(value)}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("days", e.target.value);
        router.replace(`${pathname}?${next.toString()}`);
      }}
    >
      <option value="7">Last 7 days</option>
      <option value="30">Last 30 days</option>
      <option value="90">Last 90 days</option>
      <option value="365">Last 12 months</option>
    </NativeSelect>
  );
}

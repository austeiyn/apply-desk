"use client";

import { LocateFixed } from "lucide-react";
import { detectLocationAction } from "@/app/dashboard/profile/actions";
import { useAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";

export type DetectedLocation = { city: string | null; country: string | null };

/**
 * Fills city/country from the visitor's approximate network location. No
 * browser permission prompt; the result is only a suggestion until saved.
 */
export function DetectLocationButton({ onDetected }: { onDetected: (location: DetectedLocation) => void }) {
  const detect = useAction(detectLocationAction, { onSuccess: onDetected });
  return (
    <Button type="button" variant="link" size="sm" onClick={() => void detect.run()} loading={detect.pending}>
      <LocateFixed /> Use my current location
    </Button>
  );
}

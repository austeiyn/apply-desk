"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { CLIP_STORAGE_KEY } from "@/components/applications/send-to-applydesk";

/**
 * Moves the clipped advertisement from the URL fragment (never sent to the
 * server) into this tab's sessionStorage, then opens the new-application
 * form, which reads and removes it. Storing it first means it survives the
 * sign-in redirect if the user isn't signed in yet.
 */
export function ClipReceiver() {
  useEffect(() => {
    const match = /^#d=(.+)$/.exec(window.location.hash);
    let stored = false;
    if (match) {
      try {
        const json = decodeURIComponent(match[1]!);
        JSON.parse(json);
        sessionStorage.setItem(CLIP_STORAGE_KEY, json);
        stored = true;
      } catch {
        /* unreadable or storage unavailable: open the empty form */
      }
    }
    // replace(): drop this entry (and the advertisement in its URL) from history.
    window.location.replace(stored ? "/dashboard/applications/new?clip=1" : "/dashboard/applications/new");
  }, []);

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Opening the advertisement in ApplyDesk…{" "}
      <Link href="/dashboard/applications/new" className="text-brand hover:underline">
        Continue
      </Link>
    </p>
  );
}

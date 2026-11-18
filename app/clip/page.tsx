import type { Metadata } from "next";
import { ClipReceiver } from "./clip-receiver";

export const metadata: Metadata = { title: "Importing advertisement", robots: { index: false } };

/**
 * Landing page for the "Send to ApplyDesk" bookmarklet. Public, so the
 * clipped advertisement survives a sign-in; see ClipReceiver.
 */
export default function ClipPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <ClipReceiver />
    </main>
  );
}

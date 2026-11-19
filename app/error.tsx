"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/** Last-resort boundary for unexpected errors; details stay in the server logs. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] unexpected error", error.digest ?? "");
  }, [error]);

  return (
    <div className="bg-aurora flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="max-w-md text-center">
          <p className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-coral-50 text-2xl text-coral-700" aria-hidden>
            !
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-muted-foreground">
            That didn&apos;t work, and it&apos;s not your fault. Your saved work is safe. Try again, or head back to your dashboard.
          </p>
          {error.digest ? <p className="mt-3 text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={reset}>
              <RotateCcw /> Try again
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard">Go to your dashboard</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

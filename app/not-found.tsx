import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Shown for every unknown URL. It's also what signed-in users without access
 * see for admin pages and other people's records (a 404 rather than a
 * "forbidden", so nothing is revealed about what exists).
 */
export default function NotFound() {
  return (
    <div className="bg-aurora flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl bg-card shadow-[0_20px_50px_-20px_rgba(63,42,168,0.45)] ring-1 ring-grape-100">
            <LogoMark className="size-12" />
          </div>
          <p className="text-gradient text-6xl font-semibold tracking-tight">404</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
          <p className="mt-2 text-muted-foreground">
            The link may be out of date, or the page may have been moved or deleted. Let&apos;s get you back on track.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Go to your dashboard <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/">
                <Compass /> Back to the home page
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

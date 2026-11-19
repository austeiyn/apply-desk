import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The ApplyDesk mark: an "A" with a check (applied, done) on a grape gradient
 * tile, and a coral dot. Also drawn in app/icon.svg and app/apple-icon.png;
 * keep the three in step.
 */
export function LogoMark({ className }: { className?: string }) {
  // Each instance needs its own gradient id: an id defined inside a hidden
  // (display: none) copy of the logo can't be used by a visible one.
  const gradient = `logo-grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <defs>
        <linearGradient id={gradient} x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8B6CFF" />
          <stop offset="1" stopColor="#4A2FD1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradient})`} />
      <path d="M8.6 23.6 16 7.6l7.4 16" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.7 19.3l2.6 2.6 4.4-4.9" fill="none" stroke="#FFC83D" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25.4" cy="7" r="2.3" fill="#FF6A55" />
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  compact,
  tone = "default",
}: {
  href?: string;
  className?: string;
  compact?: boolean;
  /** "light" for dark backgrounds. */
  tone?: "default" | "light";
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", tone === "light" ? "text-white" : "text-foreground", className)}>
      <LogoMark />
      {!compact ? (
        <span className="text-[17px]">
          Apply<span className={tone === "light" ? "text-grape-300" : "text-brand"}>Desk</span>
        </span>
      ) : (
        <span className="sr-only">ApplyDesk</span>
      )}
    </Link>
  );
}

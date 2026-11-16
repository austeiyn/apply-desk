import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" fill="#13233d" />
      <path d="M9 22.5 15.2 8h1.6L23 22.5h-3.1l-1.4-3.5h-5l-1.4 3.5H9Zm5.4-6h3.2L16 12.3l-1.6 4.2Z" fill="#fff" />
      <circle cx="24.5" cy="9" r="2.5" fill="#2dd4bf" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      <LogoMark />
      {!compact ? <span className="text-[17px]">ApplyDesk</span> : <span className="sr-only">ApplyDesk</span>}
    </Link>
  );
}

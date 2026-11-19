import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const points = [
  "Tailored, ATS-friendly resumes for every role",
  "Cover letters grounded in your real experience",
  "Every application tracked from saved to offer",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="bg-ink-panel relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div aria-hidden className="bg-confetti-line absolute inset-x-0 top-0 h-1" />
        <Logo tone="light" />
        <div className="relative z-10 max-w-md space-y-6">
          <p className="text-2xl font-semibold leading-snug tracking-tight">
            One job advertisement. One intelligent workspace. Everything you need to apply professionally.
          </p>
          <ul className="space-y-3 text-sm text-white/85">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint-400" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/60">Your data stays private to your account.</p>
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BannerAnnouncement {
  id: string;
  title: string;
  message: string;
  level: string;
}

const STORAGE_KEY = "applydesk:dismissed-announcements";
const listeners = new Set<() => void>();

/* Dismissed ids live in localStorage (a per-browser convenience only). */
const dismissedStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },
  getSnapshot(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "[]";
    } catch {
      return "[]";
    }
  },
  // Server render shows nothing until the client knows what was dismissed.
  getServerSnapshot(): string | null {
    return null;
  },
  dismiss(id: string) {
    let ids: string[] = [];
    try {
      ids = JSON.parse(dismissedStore.getSnapshot()) as string[];
    } catch {
      ids = [];
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, id].slice(-50)));
    } catch {
      /* storage unavailable: dismissal lasts for this view only */
    }
    listeners.forEach((l) => l());
  },
};

const styles: Record<string, { box: string; icon: typeof Info }> = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-900", icon: Info },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: CheckCircle2 },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: TriangleAlert },
};

/** Active platform announcements. */
export function AnnouncementBanner({ announcements }: { announcements: BannerAnnouncement[] }) {
  const raw = useSyncExternalStore(dismissedStore.subscribe, dismissedStore.getSnapshot, dismissedStore.getServerSnapshot);
  if (raw === null) return null;
  let dismissed: string[] = [];
  try {
    dismissed = JSON.parse(raw) as string[];
  } catch {
    dismissed = [];
  }
  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-4 sm:px-6 lg:px-8">
      {visible.map((a) => {
        const s = styles[a.level] ?? styles.info!;
        const Icon = s.icon;
        return (
          <div key={a.id} role="status" className={cn("mx-auto flex max-w-7xl items-start gap-3 rounded-lg border px-4 py-3 text-sm", s.box)}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.title}</p>
              <p className="opacity-90">{a.message}</p>
            </div>
            <button onClick={() => dismissedStore.dismiss(a.id)} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss announcement">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

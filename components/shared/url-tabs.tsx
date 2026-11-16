"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";

export interface UrlTab {
  value: string;
  label: string;
  content: React.ReactNode;
}

export function UrlTabs({ tabs, defaultTab }: { tabs: UrlTab[]; defaultTab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("tab") ?? defaultTab;
  const value = tabs.some((t) => t.value === current) ? current : defaultTab;

  return (
    <Tabs
      value={value}
      onValueChange={(v) => {
        const next = new URLSearchParams(params);
        next.set("tab", v);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="space-y-4">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

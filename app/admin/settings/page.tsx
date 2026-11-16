import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/session";
import { coerceSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Platform Settings" };

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("platform_settings").select("key, value, updated_at");
  const settings = coerceSettings(data ?? []);
  return (
    <>
      <PageHeader title="Platform Settings" description="Changes take effect immediately and are recorded in the audit log." />
      <SettingsForm initial={settings} />
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { getAiQuota } from "@/lib/ai/guard";
import { requireUser } from "@/lib/auth/session";
import { isAiConfigured, isServiceRoleConfigured } from "@/lib/env.server";
import { getPlatformSettings } from "@/lib/settings";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, userId } = await requireUser();
  const settings = await getPlatformSettings();
  const quota = isServiceRoleConfigured() ? await getAiQuota(userId) : null;

  return (
    <>
      <PageHeader title="Settings" description="Manage your account, privacy and data." />
      <SettingsView
        email={profile.email}
        isAdmin={profile.role === "admin"}
        supportAccessUntil={profile.support_access_expires_at}
        quota={quota}
        aiAvailable={isAiConfigured() && settings.ai_enabled}
        supportEmail={settings.support_email}
      />
    </>
  );
}

import { AppShell } from "@/components/app-shell/app-shell";
import { AnnouncementBanner } from "@/components/app-shell/announcement-banner";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, supabase } = await requireUser();

  const [{ data: announcements }] = await Promise.all([
    supabase.from("announcements").select("id, title, message, level").order("starts_at", { ascending: false }).limit(3),
    supabase.rpc("touch_last_active"),
  ]);

  return (
    <AppShell
      user={{ fullName: profile.full_name, email: profile.email, isAdmin: profile.role === "admin" }}
      banner={<AnnouncementBanner announcements={announcements ?? []} />}
    >
      {children}
    </AppShell>
  );
}

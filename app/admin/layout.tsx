import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · ApplyDesk Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  return (
    <AppShell area="admin" user={{ fullName: profile.full_name, email: profile.email, isAdmin: true }}>
      {children}
    </AppShell>
  );
}

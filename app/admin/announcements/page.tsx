import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/session";
import { AnnouncementsManager } from "./announcements-manager";

export const metadata: Metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Announcements" description="Messages shown at the top of every candidate's workspace while active." />
      <AnnouncementsManager announcements={data ?? []} />
    </>
  );
}

import { requireUser } from "@/lib/auth/session";
export default async function Dashboard() {
  const { profile } = await requireUser({ requireOnboarding: false });
  return <main className="p-10" data-testid="dashboard">Signed in as {profile.email} ({profile.role})</main>;
}

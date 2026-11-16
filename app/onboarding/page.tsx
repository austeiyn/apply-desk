import { requireUser } from "@/lib/auth/session";
export default async function Onboarding() {
  const { profile } = await requireUser({ requireOnboarding: false });
  return <main className="p-10" data-testid="onboarding">Onboarding for {profile.full_name}</main>;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Account suspended" };

export default async function SuspendedPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.account_status === "active") redirect("/dashboard");
  const settings = await getPlatformSettings();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <Logo />
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-rose-50 text-rose-700">
          <ShieldAlert className="size-5" />
        </div>
        <h1 className="text-lg font-semibold">Your account is suspended</h1>
        <p className="text-sm text-muted-foreground">
          Access to your workspace has been paused by a platform administrator. Your data has not been deleted.
          {settings.support_email ? (
            <>
              {" "}
              Contact{" "}
              <a className="text-brand underline" href={`mailto:${settings.support_email}`}>
                {settings.support_email}
              </a>{" "}
              for help.
            </>
          ) : null}
        </p>
        <form action="/auth/signout" method="post">
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

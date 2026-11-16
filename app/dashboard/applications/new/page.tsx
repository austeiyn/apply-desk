import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { isAiConfigured } from "@/lib/env.server";
import { NewApplicationForm } from "./new-application-form";

export const metadata: Metadata = { title: "Create Application" };

export default async function NewApplicationPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Step 1 of 3 · Add the job advertisement"
        title="Create New Application"
        description="Paste a link to the job advertisement and we'll pull in the details, or enter them yourself. Next you'll analyse your fit and generate tailored documents."
      />
      <NewApplicationForm aiConfigured={isAiConfigured()} />
    </div>
  );
}

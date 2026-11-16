"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Link2, PenLine } from "lucide-react";
import { createApplicationAction } from "@/app/dashboard/applications/actions";
import { JobDetailsFields } from "@/components/applications/job-details-fields";
import { useFormAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { jobDetailsSchema, type JobDetailsInput } from "@/lib/validation/application";

interface ImportResponse {
  ok: boolean;
  url?: string;
  message?: string;
  reason?: string;
  job?: {
    jobTitle: string | null;
    companyName: string | null;
    location: string | null;
    employmentType: string | null;
    salaryRange: string | null;
    deadline: string | null;
    description: string;
    responsibilities: string | null;
    requiredQualifications: string | null;
    requiredSkills: string | null;
    preferredQualifications: string | null;
  };
  partial?: { jobTitle: string | null; companyName: string | null };
}

const EMPTY: JobDetailsInput = {
  jobUrl: "",
  source: "manual",
  jobTitle: "",
  companyName: "",
  location: "",
  employmentType: "",
  salaryRange: "",
  deadline: "",
  jobDescription: "",
  responsibilities: "",
  requiredQualifications: "",
  requiredSkills: "",
  preferredQualifications: "",
};

export function NewApplicationForm({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [importState, setImportState] = useState<{ kind: "success" | "fallback" | "error"; message: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const form = useForm<JobDetailsInput>({ resolver: zodResolver(jobDetailsSchema) as never, defaultValues: EMPTY });
  const { onSubmit, pending } = useFormAction(form, createApplicationAction, {
    onSuccess: (data) => router.push(`/dashboard/applications/${data.id}?tab=analysis${aiConfigured ? "&analyse=1" : ""}`),
  });

  async function importUrl() {
    setImportState(null);
    if (!url.trim()) return setImportState({ kind: "error", message: "Paste a job advertisement link first." });
    setFetching(true);
    try {
      const res = await fetch("/api/jobs/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = (await res.json()) as ImportResponse & { error?: string };
      if (data.ok && data.job) {
        const j = data.job;
        form.reset({
          jobUrl: data.url ?? url.trim(),
          source: "url",
          jobTitle: j.jobTitle ?? "",
          companyName: j.companyName ?? "",
          location: j.location ?? "",
          employmentType: j.employmentType ?? "",
          salaryRange: j.salaryRange ?? "",
          deadline: j.deadline ?? "",
          jobDescription: j.description,
          responsibilities: j.responsibilities ?? "",
          requiredQualifications: j.requiredQualifications ?? "",
          requiredSkills: j.requiredSkills ?? "",
          preferredQualifications: j.preferredQualifications ?? "",
        });
        setImportState({ kind: "success", message: "We retrieved the advertisement. Check the details below and edit anything that's wrong." });
      } else {
        // Keep the link so the user can still apply through the original listing.
        form.reset({
          ...EMPTY,
          jobUrl: /^https?:\/\//i.test(url.trim()) ? url.trim() : "",
          jobTitle: data.partial?.jobTitle ?? "",
          companyName: data.partial?.companyName ?? "",
        });
        const blockedInput = data.reason === "invalid_url" || data.reason === "blocked_address" || res.status === 400;
        setImportState({ kind: blockedInput ? "error" : "fallback", message: data.message ?? data.error ?? "Something went wrong." });
        if (blockedInput) return;
      }
      setShowForm(true);
    } catch {
      setImportState({ kind: "fallback", message: "Couldn't automatically retrieve this job advertisement. Paste the job description below and we'll take care of the rest." });
      setShowForm(true);
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-brand" /> Job advertisement link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void importUrl();
            }}
          >
            <Field label="Job advertisement URL" htmlFor="importUrl" className="flex-1 [&>label]:sr-only">
              <Input
                id="importUrl"
                type="url"
                inputMode="url"
                placeholder="https://www.seek.co.nz/job/12345678"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Button type="submit" loading={fetching} className="sm:w-auto">
              {fetching ? "Retrieving…" : "Fetch job details"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            We only read publicly accessible pages. Sites that require signing in or verification won&apos;t be bypassed; paste the description instead.
          </p>
          {importState ? (
            <Alert variant={importState.kind === "success" ? "success" : importState.kind === "fallback" ? "warning" : "error"}>{importState.message}</Alert>
          ) : null}
          {!showForm ? (
            <div className="flex items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : null}
          {!showForm ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                form.reset({ ...EMPTY, jobUrl: /^https?:\/\//i.test(url.trim()) ? url.trim() : "" });
                setShowForm(true);
              }}
            >
              <PenLine /> Enter the job details manually
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {showForm ? (
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <JobDetailsFields form={form} />
          <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-brand" />
              {aiConfigured ? "Next we'll analyse how your experience matches this role." : "Your application will be saved to your tracker."}
            </p>
            <Button type="submit" loading={pending}>
              {aiConfigured ? "Save and analyse" : "Save application"} <ArrowRight />
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

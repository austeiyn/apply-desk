"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { deleteApplicationAction, updateJobDetailsAction } from "@/app/dashboard/applications/actions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useAction, useFormAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import type { JobApplication } from "@/lib/db/types";
import { jobDetailsSchema, type JobDetailsInput } from "@/lib/validation/application";
import { JobDetailsFields } from "./job-details-fields";

export function JobDetailsEditor({ application }: { application: JobApplication }) {
  const router = useRouter();
  const form = useForm<JobDetailsInput>({
    resolver: zodResolver(jobDetailsSchema) as never,
    defaultValues: {
      jobUrl: application.job_url ?? "",
      source: application.source as "url" | "manual",
      jobTitle: application.job_title,
      companyName: application.company_name,
      location: application.location ?? "",
      employmentType: application.employment_type ?? "",
      salaryRange: application.salary_range ?? "",
      deadline: application.deadline ?? "",
      jobDescription: application.job_description,
      responsibilities: application.responsibilities,
      requiredQualifications: application.required_qualifications,
      requiredSkills: application.required_skills,
      preferredQualifications: application.preferred_qualifications,
    },
  });
  const { onSubmit, pending } = useFormAction(form, (v) => updateJobDetailsAction(application.id, v), {
    onSuccess: () => {
      form.reset(form.getValues());
      router.refresh();
    },
  });
  const remove = useAction(deleteApplicationAction, { onSuccess: () => router.push("/dashboard/applications") });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <JobDetailsFields form={form} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ConfirmButton
          title="Delete this application?"
          description="The application, its analysis, interview prep, notes and timeline will be permanently deleted. Resumes and cover letters stay in your library."
          onConfirm={() => remove.run(application.id)}
        >
          <Button type="button" variant="ghost" className="text-destructive hover:bg-rose-50 hover:text-destructive">
            <Trash2 /> Delete application
          </Button>
        </ConfirmButton>
        <Button type="submit" loading={pending} disabled={!form.formState.isDirty}>
          Save job details
        </Button>
      </div>
    </form>
  );
}

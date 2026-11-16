"use client";

import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/form-controls";
import { Input, Textarea } from "@/components/ui/input";
import type { JobDetailsInput } from "@/lib/validation/application";

/** Editable job advertisement fields, shared by "create" and "edit" forms. */
export function JobDetailsFields({ form }: { form: UseFormReturn<JobDetailsInput> }) {
  const e = form.formState.errors;
  const r = form.register;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title" htmlFor="jobTitle" error={e.jobTitle?.message} required>
            <Input id="jobTitle" {...r("jobTitle")} aria-invalid={!!e.jobTitle} />
          </Field>
          <Field label="Company name" htmlFor="companyName" error={e.companyName?.message}>
            <Input id="companyName" {...r("companyName")} />
          </Field>
          <Field label="Location" htmlFor="location" optional>
            <Input id="location" {...r("location")} />
          </Field>
          <Field label="Employment type" htmlFor="employmentType" optional>
            <Input id="employmentType" placeholder="e.g. Full-time, Contract" {...r("employmentType")} />
          </Field>
          <Field label="Salary range" htmlFor="salaryRange" optional>
            <Input id="salaryRange" {...r("salaryRange")} />
          </Field>
          <Field label="Application deadline" htmlFor="deadline" error={e.deadline?.message} optional>
            <Input id="deadline" type="date" {...r("deadline")} />
          </Field>
          <Field label="Job advertisement URL" htmlFor="jobUrl" error={e.jobUrl?.message} className="sm:col-span-2" optional description="Kept as a link so you can apply through the original advertisement.">
            <Input id="jobUrl" type="url" inputMode="url" {...r("jobUrl")} aria-invalid={!!e.jobUrl} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job description</CardTitle>
          <CardDescription>Paste the full advertisement. The more complete it is, the better the analysis and documents.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Job description" htmlFor="jobDescription" error={e.jobDescription?.message}>
            <Textarea id="jobDescription" rows={12} className="font-normal" {...r("jobDescription")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Key responsibilities" htmlFor="responsibilities" optional description="Filled in automatically by the analysis if left blank.">
              <Textarea id="responsibilities" rows={5} {...r("responsibilities")} />
            </Field>
            <Field label="Required skills" htmlFor="requiredSkills" optional>
              <Textarea id="requiredSkills" rows={5} {...r("requiredSkills")} />
            </Field>
            <Field label="Required qualifications" htmlFor="requiredQualifications" optional>
              <Textarea id="requiredQualifications" rows={5} {...r("requiredQualifications")} />
            </Field>
            <Field label="Preferred qualifications" htmlFor="preferredQualifications" optional>
              <Textarea id="preferredQualifications" rows={5} {...r("preferredQualifications")} />
            </Field>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

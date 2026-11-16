"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateCareerAction, updatePersonalAction } from "@/app/dashboard/profile/actions";
import { TagInput } from "@/components/shared/tag-input";
import { useFormAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field } from "@/components/ui/form-controls";
import { Input, Textarea } from "@/components/ui/input";
import { EMPLOYMENT_TYPES, WORK_ARRANGEMENTS } from "@/lib/constants";
import type { CandidateProfile, Profile } from "@/lib/db/types";
import { careerSchema, personalSchema, type CareerInput, type PersonalInput } from "@/lib/validation/profile";

export function PersonalForm({ profile, candidate }: { profile: Profile; candidate: CandidateProfile }) {
  const form = useForm<PersonalInput>({
    resolver: zodResolver(personalSchema) as never,
    defaultValues: {
      fullName: profile.full_name,
      professionalTitle: candidate.professional_title ?? "",
      contactEmail: candidate.contact_email ?? "",
      phone: candidate.phone ?? "",
      location: candidate.location ?? "",
      country: candidate.country ?? "",
      linkedinUrl: candidate.linkedin_url ?? "",
      portfolioUrl: candidate.portfolio_url ?? "",
      githubUrl: candidate.github_url ?? "",
      websiteUrl: candidate.website_url ?? "",
    },
  });
  const { onSubmit, pending } = useFormAction(form, updatePersonalAction);
  const e = form.formState.errors;
  const r = form.register;

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Shown at the top of your resumes and cover letters.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="fullName" error={e.fullName?.message} required>
            <Input id="fullName" autoComplete="name" {...r("fullName")} aria-invalid={!!e.fullName} />
          </Field>
          <Field label="Professional title" htmlFor="professionalTitle" error={e.professionalTitle?.message} description="e.g. Senior Web Developer">
            <Input id="professionalTitle" {...r("professionalTitle")} />
          </Field>
          <Field label="Contact email" htmlFor="contactEmail" error={e.contactEmail?.message} description="Used on documents. Defaults to your account email.">
            <Input id="contactEmail" type="email" autoComplete="email" {...r("contactEmail")} aria-invalid={!!e.contactEmail} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={e.phone?.message} optional>
            <Input id="phone" type="tel" autoComplete="tel" {...r("phone")} />
          </Field>
          <Field label="City" htmlFor="location" error={e.location?.message} optional>
            <Input id="location" autoComplete="address-level2" {...r("location")} />
          </Field>
          <Field label="Country" htmlFor="country" error={e.country?.message} optional>
            <Input id="country" autoComplete="country-name" {...r("country")} />
          </Field>
          <Field label="LinkedIn URL" htmlFor="linkedinUrl" error={e.linkedinUrl?.message} optional>
            <Input id="linkedinUrl" inputMode="url" placeholder="linkedin.com/in/your-name" {...r("linkedinUrl")} aria-invalid={!!e.linkedinUrl} />
          </Field>
          <Field label="Portfolio URL" htmlFor="portfolioUrl" error={e.portfolioUrl?.message} optional>
            <Input id="portfolioUrl" inputMode="url" {...r("portfolioUrl")} aria-invalid={!!e.portfolioUrl} />
          </Field>
          <Field label="GitHub URL" htmlFor="githubUrl" error={e.githubUrl?.message} optional>
            <Input id="githubUrl" inputMode="url" {...r("githubUrl")} aria-invalid={!!e.githubUrl} />
          </Field>
          <Field label="Personal website" htmlFor="websiteUrl" error={e.websiteUrl?.message} optional>
            <Input id="websiteUrl" inputMode="url" {...r("websiteUrl")} aria-invalid={!!e.websiteUrl} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={pending}>
            Save personal details
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function CareerForm({ candidate }: { candidate: CandidateProfile }) {
  const form = useForm<CareerInput>({
    resolver: zodResolver(careerSchema) as never,
    defaultValues: {
      professionalSummary: candidate.professional_summary ?? "",
      yearsExperience: candidate.years_experience ?? "",
      currentOccupation: candidate.current_occupation ?? "",
      preferredJobTitles: candidate.preferred_job_titles,
      preferredIndustries: candidate.preferred_industries,
      preferredEmploymentTypes: candidate.preferred_employment_types as CareerInput["preferredEmploymentTypes"],
      preferredLocations: candidate.preferred_locations ?? "",
      workArrangements: candidate.work_arrangements as CareerInput["workArrangements"],
      salaryExpectation: candidate.salary_expectation ?? "",
    },
  });
  const { onSubmit, pending } = useFormAction(form, updateCareerAction);
  const e = form.formState.errors;
  const r = form.register;

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader>
          <CardTitle>Career information</CardTitle>
          <CardDescription>Your summary and job preferences help tailor every application.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Professional summary"
            htmlFor="professionalSummary"
            error={e.professionalSummary?.message}
            className="sm:col-span-2"
            description="Two to four sentences about your experience, strengths and the work you do best."
          >
            <Textarea id="professionalSummary" rows={5} {...r("professionalSummary")} />
          </Field>
          <Field label="Current occupation" htmlFor="currentOccupation" error={e.currentOccupation?.message} optional>
            <Input id="currentOccupation" {...r("currentOccupation")} />
          </Field>
          <Field label="Total years of experience" htmlFor="yearsExperience" error={e.yearsExperience?.message} optional>
            <Input id="yearsExperience" type="number" min={0} max={70} step={0.5} inputMode="decimal" {...r("yearsExperience")} />
          </Field>
          <Field label="Preferred job titles" htmlFor="preferredJobTitles" description="Press Enter after each title." optional>
            <Controller
              control={form.control}
              name="preferredJobTitles"
              render={({ field }) => <TagInput id="preferredJobTitles" value={(field.value as string[]) ?? []} onChange={field.onChange} max={20} />}
            />
          </Field>
          <Field label="Preferred industries" htmlFor="preferredIndustries" optional>
            <Controller
              control={form.control}
              name="preferredIndustries"
              render={({ field }) => <TagInput id="preferredIndustries" value={(field.value as string[]) ?? []} onChange={field.onChange} max={20} />}
            />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-[13px] font-medium">Preferred employment type</legend>
            <Controller
              control={form.control}
              name="preferredEmploymentTypes"
              render={({ field }) => (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {EMPLOYMENT_TYPES.slice(0, 6).map((t) => {
                    const values = (field.value ?? []) as string[];
                    const checked = values.includes(t.value);
                    return (
                      <label key={t.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => field.onChange(c ? [...values, t.value] : values.filter((v) => v !== t.value))}
                        />
                        {t.label}
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-[13px] font-medium">Work arrangement</legend>
            <Controller
              control={form.control}
              name="workArrangements"
              render={({ field }) => (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {WORK_ARRANGEMENTS.map((t) => {
                    const values = (field.value ?? []) as string[];
                    const checked = values.includes(t.value);
                    return (
                      <label key={t.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => field.onChange(c ? [...values, t.value] : values.filter((v) => v !== t.value))}
                        />
                        {t.label}
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>
          <Field label="Preferred work locations" htmlFor="preferredLocations" error={e.preferredLocations?.message} optional>
            <Input id="preferredLocations" placeholder="e.g. Auckland, Wellington, remote within NZ" {...r("preferredLocations")} />
          </Field>
          <Field label="Salary expectations" htmlFor="salaryExpectation" error={e.salaryExpectation?.message} optional description="Private. Used only to help answer application questions.">
            <Input id="salaryExpectation" placeholder="e.g. NZ$110k–125k" {...r("salaryExpectation")} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={pending}>
            Save career information
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

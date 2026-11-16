"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Check, FileUp, PenLine } from "lucide-react";
import { CvUploader } from "@/components/cv/cv-uploader";
import { TagInput } from "@/components/shared/tag-input";
import { useFormAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { EMPLOYMENT_TYPES, WORK_ARRANGEMENTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { onboardingBasicsSchema, onboardingPrefsSchema } from "@/lib/validation/onboarding";
import { completeOnboardingAction, saveOnboardingBasicsAction } from "./actions";

type Basics = z.input<typeof onboardingBasicsSchema>;
type Prefs = z.input<typeof onboardingPrefsSchema>;

const STEPS = ["About you", "Your experience", "What you're looking for"];

export function OnboardingWizard({ userId, aiConfigured, defaults }: { userId: string; aiConfigured: boolean; defaults: Basics }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [experienceChoice, setExperienceChoice] = useState<"upload" | "manual" | null>(null);
  const [uploaded, setUploaded] = useState<{ cvId: string; parsed: boolean } | null>(null);

  const basicsForm = useForm<Basics>({ resolver: zodResolver(onboardingBasicsSchema) as never, defaultValues: defaults });
  const basics = useFormAction(basicsForm, saveOnboardingBasicsAction, { onSuccess: () => setStep(1) });

  const prefsForm = useForm<Prefs>({
    resolver: zodResolver(onboardingPrefsSchema) as never,
    defaultValues: { preferredJobTitles: [], workArrangements: [], preferredEmploymentTypes: [], preferredLocations: "" },
  });
  const prefs = useFormAction(prefsForm, completeOnboardingAction, {
    onSuccess: () => {
      if (uploaded?.parsed) router.push(`/dashboard/cv/${uploaded.cvId}/review`);
      else if (experienceChoice === "manual") router.push("/dashboard/profile?tab=experience");
      else router.push("/dashboard");
    },
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-brand">Welcome to ApplyDesk</p>
        <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your career profile</h1>
        <p className="text-sm text-muted-foreground">Three quick steps. Everything here is optional except your name, and you can change it all later.</p>
      </div>

      <ol className="flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                i < step ? "bg-brand text-brand-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:inline", i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
            {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={basics.onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Field label="Full name" htmlFor="fullName" error={basicsForm.formState.errors.fullName?.message} required className="sm:col-span-2">
                <Input id="fullName" autoComplete="name" {...basicsForm.register("fullName")} />
              </Field>
              <Field label="Professional title" htmlFor="professionalTitle" optional className="sm:col-span-2" description="e.g. Marketing Coordinator, Registered Nurse, Full-stack Developer">
                <Input id="professionalTitle" {...basicsForm.register("professionalTitle")} />
              </Field>
              <Field label="City" htmlFor="location" optional>
                <Input id="location" autoComplete="address-level2" {...basicsForm.register("location")} />
              </Field>
              <Field label="Country" htmlFor="country" optional>
                <Input id="country" autoComplete="country-name" {...basicsForm.register("country")} />
              </Field>
              <Field label="Phone" htmlFor="phone" optional className="sm:col-span-2">
                <Input id="phone" type="tel" autoComplete="tel" {...basicsForm.register("phone")} />
              </Field>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" loading={basics.pending}>
                  Continue
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          {!uploaded ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "upload" as const, icon: FileUp, title: "Upload my CV", body: aiConfigured ? "We'll extract your experience for you to review." : "We'll store it as your master CV." },
                { key: "manual" as const, icon: PenLine, title: "Enter it myself", body: "Add roles, education and skills in your profile." },
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setExperienceChoice(o.key)}
                  aria-pressed={experienceChoice === o.key}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-brand/50",
                    experienceChoice === o.key && "border-brand ring-2 ring-brand/15",
                  )}
                >
                  <o.icon className="size-5 text-brand" />
                  <span className="font-medium">{o.title}</span>
                  <span className="text-sm text-muted-foreground">{o.body}</span>
                </button>
              ))}
            </div>
          ) : null}

          {experienceChoice === "upload" && !uploaded ? <CvUploader userId={userId} aiConfigured={aiConfigured} compact onDone={setUploaded} /> : null}

          {uploaded ? (
            <Alert variant="success" title="CV uploaded">
              {uploaded.parsed
                ? "We've extracted your details. After this last step you'll review them before anything is added to your profile."
                : "Your CV is saved as your master document. You can add your experience to your profile next."}
            </Alert>
          ) : null}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <div className="flex gap-2">
              {!uploaded ? (
                <Button variant="outline" onClick={() => setStep(2)}>
                  Skip for now
                </Button>
              ) : null}
              <Button onClick={() => setStep(2)} disabled={experienceChoice === "upload" && !uploaded}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={prefs.onSubmit} className="space-y-5" noValidate>
              <Field label="Job titles you're targeting" htmlFor="preferredJobTitles" description="Press Enter after each one." optional>
                <Controller
                  control={prefsForm.control}
                  name="preferredJobTitles"
                  render={({ field }) => <TagInput id="preferredJobTitles" value={(field.value as string[]) ?? []} onChange={field.onChange} max={20} />}
                />
              </Field>
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium">Work arrangement</legend>
                <Controller
                  control={prefsForm.control}
                  name="workArrangements"
                  render={({ field }) => {
                    const values = (field.value ?? []) as string[];
                    return (
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {WORK_ARRANGEMENTS.map((w) => (
                          <label key={w.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={values.includes(w.value)}
                              onCheckedChange={(c) => field.onChange(c ? [...values, w.value] : values.filter((v) => v !== w.value))}
                            />
                            {w.label}
                          </label>
                        ))}
                      </div>
                    );
                  }}
                />
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium">Employment type</legend>
                <Controller
                  control={prefsForm.control}
                  name="preferredEmploymentTypes"
                  render={({ field }) => {
                    const values = (field.value ?? []) as string[];
                    return (
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {EMPLOYMENT_TYPES.slice(0, 5).map((t) => (
                          <label key={t.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={values.includes(t.value)}
                              onCheckedChange={(c) => field.onChange(c ? [...values, t.value] : values.filter((v) => v !== t.value))}
                            />
                            {t.label}
                          </label>
                        ))}
                      </div>
                    );
                  }}
                />
              </fieldset>
              <Field label="Preferred locations" htmlFor="preferredLocations" optional>
                <Input id="preferredLocations" {...prefsForm.register("preferredLocations")} />
              </Field>
              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" loading={prefs.pending}>
                  {uploaded?.parsed ? "Finish and review my CV" : "Finish setup"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

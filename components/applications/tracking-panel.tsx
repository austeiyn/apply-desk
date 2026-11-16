"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { addNoteEventAction, deleteInterviewAction, saveInterviewAction, updateTrackingAction } from "@/app/dashboard/applications/actions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useAction, useFormAction } from "@/components/shared/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-controls";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { APPLICATION_STATUSES, INTERVIEW_OUTCOMES, INTERVIEW_TYPES, STATUS_META, type ApplicationStatus } from "@/lib/constants";
import type { ApplicationEvent, Interview, JobApplication } from "@/lib/db/types";
import { formatDateTime } from "@/lib/utils";
import { trackingSchema, type TrackingInput } from "@/lib/validation/application";

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function InterviewDialog({ applicationId, interview, open, onOpenChange }: { applicationId: string; interview: Interview | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [values, setValues] = useState(() => ({
    scheduledAt: toLocalInput(interview?.scheduled_at),
    durationMinutes: interview?.duration_minutes ? String(interview.duration_minutes) : "",
    interviewType: interview?.interview_type ?? "video",
    location: interview?.location ?? "",
    interviewers: interview?.interviewers ?? "",
    notes: interview?.notes ?? "",
    outcome: interview?.outcome ?? "pending",
  }));
  const { run, pending, error } = useAction(saveInterviewAction, {
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{interview ? "Edit interview" : "Add interview"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            // Convert the local datetime to an ISO string with the browser's timezone.
            const scheduledAt = values.scheduledAt ? new Date(values.scheduledAt).toISOString() : "";
            void run(applicationId, interview?.id ?? null, { ...values, scheduledAt });
          }}
        >
          <Field label="Date and time" htmlFor="iv-when" required error={error && !values.scheduledAt ? "Choose a date and time." : undefined}>
            <Input id="iv-when" type="datetime-local" value={values.scheduledAt} onChange={set("scheduledAt")} required />
          </Field>
          <Field label="Duration (minutes)" htmlFor="iv-duration" optional>
            <Input id="iv-duration" type="number" min={1} max={1440} value={values.durationMinutes} onChange={set("durationMinutes")} />
          </Field>
          <Field label="Type" htmlFor="iv-type">
            <NativeSelect id="iv-type" value={values.interviewType} onChange={set("interviewType")}>
              {INTERVIEW_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Outcome" htmlFor="iv-outcome">
            <NativeSelect id="iv-outcome" value={values.outcome} onChange={set("outcome")}>
              {INTERVIEW_OUTCOMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Location or video link" htmlFor="iv-location" optional className="sm:col-span-2">
            <Input id="iv-location" value={values.location} onChange={set("location")} />
          </Field>
          <Field label="Interviewers" htmlFor="iv-who" optional className="sm:col-span-2">
            <Input id="iv-who" value={values.interviewers} onChange={set("interviewers")} />
          </Field>
          <Field label="Interview notes" htmlFor="iv-notes" optional className="sm:col-span-2">
            <Textarea id="iv-notes" rows={5} value={values.notes} onChange={set("notes")} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save interview
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const EVENT_LABELS: Record<string, string> = {
  created: "Application created",
  status_changed: "Status changed",
  analysis_completed: "Job analysed",
  resume_generated: "Resume generated",
  cover_letter_generated: "Cover letter generated",
  interview_added: "Interview added",
  interview_prep_generated: "Interview prep generated",
  note: "Note",
};

export function TrackingPanel({ application, interviews, events }: { application: JobApplication; interviews: Interview[]; events: ApplicationEvent[] }) {
  const router = useRouter();
  const form = useForm<TrackingInput>({
    resolver: zodResolver(trackingSchema) as never,
    defaultValues: {
      applicationStatus: application.application_status as ApplicationStatus,
      applicationDate: application.application_date ?? "",
      deadline: application.deadline ?? "",
      recruiterName: application.recruiter_name ?? "",
      recruiterEmail: application.recruiter_email ?? "",
      recruiterPhone: application.recruiter_phone ?? "",
      nextAction: application.next_action ?? "",
      nextActionDate: application.next_action_date ?? "",
      followUpDate: application.follow_up_date ?? "",
      offeredSalary: application.offered_salary ?? "",
      finalOutcome: application.final_outcome ?? "",
      notes: application.notes,
    },
  });
  const { onSubmit, pending } = useFormAction(form, (v) => updateTrackingAction(application.id, v), {
    onSuccess: () => {
      form.reset(form.getValues());
      router.refresh();
    },
  });
  const e = form.formState.errors;
  const r = form.register;

  const [dialog, setDialog] = useState<{ open: boolean; interview: Interview | null; key: number }>({ open: false, interview: null, key: 0 });
  const removeInterview = useAction(deleteInterviewAction, { onSuccess: () => router.refresh() });
  const [note, setNote] = useState("");
  const addNote = useAction(addNoteEventAction, {
    onSuccess: () => {
      setNote("");
      router.refresh();
    },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <form onSubmit={onSubmit} noValidate>
            <CardHeader>
              <CardTitle>Application tracking</CardTitle>
              <CardDescription>You decide when an application has been submitted; ApplyDesk never marks it for you.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Status" htmlFor="applicationStatus">
                <NativeSelect id="applicationStatus" {...r("applicationStatus")}>
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Application date" htmlFor="applicationDate" error={e.applicationDate?.message} optional>
                <Input id="applicationDate" type="date" {...r("applicationDate")} />
              </Field>
              <Field label="Deadline" htmlFor="trackDeadline" error={e.deadline?.message} optional>
                <Input id="trackDeadline" type="date" {...r("deadline")} />
              </Field>
              <Field label="Follow-up date" htmlFor="followUpDate" error={e.followUpDate?.message} optional>
                <Input id="followUpDate" type="date" {...r("followUpDate")} />
              </Field>
              <Field label="Next action" htmlFor="nextAction" optional>
                <Input id="nextAction" placeholder="e.g. Call recruiter" {...r("nextAction")} />
              </Field>
              <Field label="Next action date" htmlFor="nextActionDate" error={e.nextActionDate?.message} optional>
                <Input id="nextActionDate" type="date" {...r("nextActionDate")} />
              </Field>
              <Field label="Recruiter name" htmlFor="recruiterName" optional>
                <Input id="recruiterName" {...r("recruiterName")} />
              </Field>
              <Field label="Recruiter email" htmlFor="recruiterEmail" error={e.recruiterEmail?.message} optional>
                <Input id="recruiterEmail" type="email" {...r("recruiterEmail")} />
              </Field>
              <Field label="Recruiter phone" htmlFor="recruiterPhone" optional>
                <Input id="recruiterPhone" type="tel" {...r("recruiterPhone")} />
              </Field>
              <Field label="Offered salary" htmlFor="offeredSalary" optional>
                <Input id="offeredSalary" {...r("offeredSalary")} />
              </Field>
              <Field label="Final outcome" htmlFor="finalOutcome" optional className="sm:col-span-2">
                <Input id="finalOutcome" placeholder="e.g. Accepted offer, starting 3 March" {...r("finalOutcome")} />
              </Field>
              <Field label="Notes" htmlFor="trackNotes" optional className="sm:col-span-2">
                <Textarea id="trackNotes" rows={6} {...r("notes")} />
              </Field>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" loading={pending} disabled={!form.formState.isDirty}>
                Save tracking details
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Interviews</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, interview: null, key: Date.now() })}>
              <Plus /> Add
            </Button>
          </CardHeader>
          <CardContent>
            {interviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No interviews recorded.</p>
            ) : (
              <ul className="space-y-3">
                {interviews.map((iv) => (
                  <li key={iv.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-2">
                      <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{formatDateTime(iv.scheduled_at)}</p>
                        <p className="text-xs text-muted-foreground">
                          {INTERVIEW_TYPES.find((t) => t.value === iv.interview_type)?.label}
                          {iv.duration_minutes ? ` · ${iv.duration_minutes} min` : ""}
                          {iv.interviewers ? ` · ${iv.interviewers}` : ""}
                        </p>
                        {iv.notes ? <p className="mt-1 line-clamp-3 text-sm text-foreground/80">{iv.notes}</p> : null}
                      </div>
                      <Badge variant={iv.outcome === "progressed" ? "success" : iv.outcome === "not_progressed" ? "danger" : "default"}>
                        {INTERVIEW_OUTCOMES.find((o) => o.value === iv.outcome)?.label.split(" /")[0]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label="Edit interview" onClick={() => setDialog({ open: true, interview: iv, key: Date.now() })}>
                        <Pencil />
                      </Button>
                      <ConfirmButton title="Delete this interview?" description="This can't be undone." onConfirm={() => removeInterview.run(application.id, iv.id)}>
                        <Button size="icon-sm" variant="ghost" aria-label="Delete interview" className="text-muted-foreground hover:text-destructive">
                          <Trash2 />
                        </Button>
                      </ConfirmButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex gap-2"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (note.trim()) void addNote.run(application.id, note);
              }}
            >
              <Input aria-label="Add a note to the timeline" placeholder="Add a note, e.g. 'Spoke to recruiter'" value={note} maxLength={1000} onChange={(ev) => setNote(ev.target.value)} />
              <Button type="submit" size="icon" variant="outline" aria-label="Add note" loading={addNote.pending}>
                {!addNote.pending ? <MessageSquarePlus /> : null}
              </Button>
            </form>
            <ol className="relative space-y-4 border-l pl-4">
              {events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-brand ring-4 ring-card" aria-hidden />
                  <p className="text-sm font-medium">
                    {ev.event_type === "status_changed" && ev.to_status
                      ? `Moved to ${STATUS_META[ev.to_status as ApplicationStatus]?.label ?? ev.to_status}`
                      : (EVENT_LABELS[ev.event_type] ?? ev.event_type)}
                  </p>
                  {ev.description && ev.event_type !== "created" ? <p className="text-sm text-foreground/80">{ev.description}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatDateTime(ev.created_at)}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
      {dialog.open ? (
        <InterviewDialog key={dialog.key} applicationId={application.id} interview={dialog.interview} open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
      ) : null}
    </div>
  );
}

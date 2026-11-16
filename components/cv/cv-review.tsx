"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { applyParsedCvAction, type ApplyCvSelection } from "@/app/dashboard/cv/actions";
import { useAction } from "@/components/shared/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/form-controls";
import type { CvExtraction } from "@/lib/ai/cv-extractor";
import { employmentTypeLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

type PersonalKey = keyof CvExtraction["personal"];

const PERSONAL_LABELS: Record<PersonalKey, string> = {
  full_name: "Full name",
  professional_title: "Professional title",
  email: "Contact email",
  phone: "Phone",
  city: "City",
  country: "Country",
  linkedin_url: "LinkedIn",
  portfolio_url: "Portfolio",
  github_url: "GitHub",
  website_url: "Website",
};

export interface CurrentProfileSnapshot {
  personal: Record<PersonalKey, string | null>;
  summary: string | null;
  experienceKeys: string[];
  educationKeys: string[];
  skillNames: string[];
  certificationNames: string[];
  projectTitles: string[];
  extraKeys: string[];
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function fmt(d: string | null) {
  if (!d) return "";
  const [y, m] = d.split("-");
  if (!m) return y ?? "";
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-NZ", { month: "short", year: "numeric" });
}

function toggle(list: number[], i: number) {
  return list.includes(i) ? list.filter((x) => x !== i) : [...list, i];
}

function ItemCheck({
  checked,
  onChange,
  duplicate,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  duplicate?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40", checked && "border-brand/40 bg-accent/30")}>
      <Checkbox checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <div className="min-w-0 flex-1 text-sm">
        {children}
        {duplicate ? (
          <Badge variant="outline" className="mt-1.5">
            Already in your profile
          </Badge>
        ) : null}
      </div>
    </label>
  );
}

export function CvReview({ cvId, data, current }: { cvId: string; data: CvExtraction; current: CurrentProfileSnapshot }) {
  const router = useRouter();

  const dup = useMemo(
    () => ({
      exp: data.work_experiences.map((e) => current.experienceKeys.includes(`${norm(e.company)}|${norm(e.job_title)}|${e.start_date?.slice(0, 7) ?? ""}`)),
      edu: data.education.map((e) => current.educationKeys.includes(`${norm(e.institution)}|${norm(e.qualification)}`)),
      skill: data.skills.map((s) => current.skillNames.includes(s.name.toLowerCase())),
      cert: data.certifications.map((c) => current.certificationNames.includes(norm(c.name))),
      proj: data.projects.map((p) => current.projectTitles.includes(norm(p.title))),
      extra: data.extras.map((x) => current.extraKeys.includes(`${x.kind}|${norm(x.title)}`)),
    }),
    [data, current],
  );

  const indices = (flags: boolean[]) => flags.map((d, i) => (d ? -1 : i)).filter((i) => i >= 0);

  const [sel, setSel] = useState<Required<ApplyCvSelection>>(() => ({
    // Never overwrite silently: only pre-select personal fields that are empty today.
    personal: (Object.keys(PERSONAL_LABELS) as PersonalKey[]).filter((k) => data.personal[k] && !current.personal[k]),
    summary: Boolean(data.professional_summary && !current.summary),
    experiences: indices(dup.exp),
    education: indices(dup.edu),
    skills: indices(dup.skill),
    certifications: indices(dup.cert),
    projects: indices(dup.proj),
    extras: indices(dup.extra),
  }));

  const { run, pending } = useAction(applyParsedCvAction, { onSuccess: () => router.push("/dashboard/profile?tab=experience") });

  const personalRows = (Object.keys(PERSONAL_LABELS) as PersonalKey[]).filter((k) => data.personal[k]);
  const total =
    sel.personal.length +
    (sel.summary ? 1 : 0) +
    sel.experiences.length +
    sel.education.length +
    sel.skills.length +
    sel.certifications.length +
    sel.projects.length +
    sel.extras.length;

  return (
    <div className="space-y-6">
      <Alert variant="info" title="Review before anything is saved">
        Tick what you want to add. Existing profile details are only replaced where you choose to, and duplicates are skipped automatically. You can
        edit everything afterwards.
      </Alert>

      {data.notes.length > 0 ? (
        <Alert variant="warning" title="Please double-check">
          <ul className="list-disc space-y-0.5 pl-4">
            {data.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {personalRows.length > 0 || data.professional_summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>Fields you already have are unticked by default so they aren&apos;t overwritten.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {personalRows.map((k) => {
              const checked = sel.personal.includes(k);
              const existing = current.personal[k];
              return (
                <label key={k} className="grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-lg border p-3 hover:bg-muted/40 sm:grid-cols-[auto_150px_1fr_1fr]">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => setSel((s) => ({ ...s, personal: checked ? s.personal.filter((x) => x !== k) : [...s.personal, k] }))}
                  />
                  <span className="text-sm font-medium">{PERSONAL_LABELS[k]}</span>
                  <span className="col-start-2 break-words text-sm sm:col-start-auto">
                    <span className="text-xs text-muted-foreground sm:hidden">From CV: </span>
                    {data.personal[k]}
                  </span>
                  <span className="col-start-2 break-words text-sm text-muted-foreground sm:col-start-auto">
                    {existing ? <>Current: {existing}</> : <span className="italic">Currently empty</span>}
                  </span>
                </label>
              );
            })}
            {data.professional_summary ? (
              <label className="flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-muted/40">
                <Checkbox checked={sel.summary} onCheckedChange={() => setSel((s) => ({ ...s, summary: !s.summary }))} className="mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Professional summary</p>
                  <p className="text-foreground/85">{data.professional_summary}</p>
                  {current.summary ? <p className="text-xs text-muted-foreground">Ticking this replaces your current summary.</p> : null}
                </div>
              </label>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {data.work_experiences.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Work experience ({data.work_experiences.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.work_experiences.map((e, i) => (
              <ItemCheck key={i} checked={sel.experiences.includes(i)} onChange={() => setSel((s) => ({ ...s, experiences: toggle(s.experiences, i) }))} duplicate={dup.exp[i]}>
                <p className="font-medium">
                  {e.job_title} · {e.company}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[fmt(e.start_date), e.is_current ? "Present" : fmt(e.end_date)].filter(Boolean).join(" – ")}
                  {e.location ? ` · ${e.location}` : ""}
                  {e.employment_type ? ` · ${employmentTypeLabel(e.employment_type)}` : ""}
                </p>
                {e.responsibilities.length + e.achievements.length > 0 ? (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-foreground/80">
                    {[...e.responsibilities, ...e.achievements].slice(0, 6).map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </ItemCheck>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data.education.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Education ({data.education.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.education.map((e, i) => (
              <ItemCheck key={i} checked={sel.education.includes(i)} onChange={() => setSel((s) => ({ ...s, education: toggle(s.education, i) }))} duplicate={dup.edu[i]}>
                <p className="font-medium">{[e.qualification, e.field_of_study].filter(Boolean).join(", ")}</p>
                <p className="text-xs text-muted-foreground">
                  {e.institution}
                  {e.graduation_date ? ` · ${fmt(e.graduation_date)}` : ""}
                </p>
              </ItemCheck>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data.skills.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Skills ({data.skills.length})</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSel((s) => ({ ...s, skills: indices(dup.skill) }))}>
                Select new
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSel((s) => ({ ...s, skills: [] }))}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.skills.map((s, i) => {
              const checked = sel.skills.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={dup.skill[i]}
                  aria-pressed={checked}
                  onClick={() => setSel((x) => ({ ...x, skills: toggle(x.skills, i) }))}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm transition-colors",
                    checked ? "border-brand bg-accent text-accent-foreground" : "bg-card hover:bg-muted",
                    dup.skill[i] && "cursor-not-allowed opacity-50 line-through",
                  )}
                  title={dup.skill[i] ? "Already in your profile" : undefined}
                >
                  {s.name}
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {data.certifications.length + data.projects.length + data.extras.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Certifications, projects and more</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.certifications.map((c, i) => (
              <ItemCheck
                key={`c${i}`}
                checked={sel.certifications.includes(i)}
                onChange={() => setSel((s) => ({ ...s, certifications: toggle(s.certifications, i) }))}
                duplicate={dup.cert[i]}
              >
                <p className="font-medium">
                  <span className="text-xs uppercase text-muted-foreground">Certification · </span>
                  {c.name}
                </p>
                {c.institution ? <p className="text-xs text-muted-foreground">{c.institution}</p> : null}
              </ItemCheck>
            ))}
            {data.projects.map((p, i) => (
              <ItemCheck key={`p${i}`} checked={sel.projects.includes(i)} onChange={() => setSel((s) => ({ ...s, projects: toggle(s.projects, i) }))} duplicate={dup.proj[i]}>
                <p className="font-medium">
                  <span className="text-xs uppercase text-muted-foreground">Project · </span>
                  {p.title}
                </p>
                {p.description ? <p className="line-clamp-2 text-foreground/80">{p.description}</p> : null}
              </ItemCheck>
            ))}
            {data.extras.map((x, i) => (
              <ItemCheck key={`x${i}`} checked={sel.extras.includes(i)} onChange={() => setSel((s) => ({ ...s, extras: toggle(s.extras, i) }))} duplicate={dup.extra[i]}>
                <p className="font-medium">
                  <span className="text-xs uppercase text-muted-foreground">{x.kind} · </span>
                  {x.title}
                </p>
                {x.organisation ? <p className="text-xs text-muted-foreground">{x.organisation}</p> : null}
              </ItemCheck>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="sticky bottom-4 z-10 flex flex-col items-start gap-3 rounded-xl border bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="size-4" /> {total} item{total === 1 ? "" : "s"} selected
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/cv")}>
            Cancel
          </Button>
          <Button onClick={() => run(cvId, sel)} loading={pending} disabled={total === 0}>
            Add selected to profile
          </Button>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  FileText,
  Kanban,
  Link2,
  Lock,
  MessagesSquare,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/** Each step and feature gets its own brand colour (tinted tile, 700 step for the icon). */
const TILE = {
  grape: "bg-grape-50 text-grape-700",
  coral: "bg-coral-50 text-coral-700",
  mint: "bg-mint-50 text-mint-700",
  ocean: "bg-ocean-50 text-ocean-700",
  bloom: "bg-bloom-50 text-bloom-700",
  sun: "bg-sun-100 text-sun-700",
} as const;
type Tone = keyof typeof TILE;
const STEP_TONES: Tone[] = ["grape", "ocean", "bloom", "coral", "mint"];
const FEATURE_TONES: Tone[] = ["ocean", "coral", "bloom", "sun", "mint", "grape"];

const steps = [
  { icon: Upload, title: "Build your profile once", body: "Upload your CV or enter your experience. Review everything we extract before it's saved." },
  { icon: Link2, title: "Paste a job link", body: "We retrieve the advertisement, or you paste the description if the site blocks automated access." },
  { icon: Target, title: "See how you fit", body: "A transparent requirements matrix shows strong matches, partial matches and genuine gaps." },
  { icon: FileText, title: "Generate tailored documents", body: "A resume and cover letter written for this role, using only experience you've confirmed." },
  { icon: Kanban, title: "Apply and track", body: "Download DOCX or PDF, apply on the original listing, and track progress to an offer." },
];

const features = [
  { icon: FileSearch, title: "Job advertisement analysis", body: "Responsibilities, required and preferred skills, ATS keywords and the phrases the employer uses, extracted automatically." },
  { icon: ClipboardList, title: "Requirements matrix", body: "Every requirement mapped to evidence from your profile, rated Strong, Partial, Not evidenced or Missing qualification." },
  { icon: FileText, title: "ATS-friendly resumes", body: "Single-column, standard headings and real text. Edit any section, reorder, regenerate and restore earlier versions." },
  { icon: ScrollText, title: "Personalised cover letters", body: "Five tones, from concise and direct to executive. Grounded in your achievements, never generic filler." },
  { icon: MessagesSquare, title: "Interview preparation", body: "Questions drawn from the actual advertisement, with STAR-structured answers built from your verified experience." },
  { icon: Kanban, title: "Application tracker", body: "A Kanban board and table for every role, with deadlines, follow-ups, interviews, recruiter details and notes." },
];

const integrity = [
  "Never invents employers, dates, qualifications or results",
  "Skills you haven't confirmed are flagged as gaps, not added",
  "Figures not found in your profile are highlighted for you to check",
  "You review and edit every document before it leaves ApplyDesk",
];

const faqs = [
  {
    q: "Will ApplyDesk make things up to improve my chances?",
    a: "No. The AI can improve wording, structure and emphasis, but it may only use facts from your verified profile. Employers, job titles, dates and qualifications in your resume are copied directly from your records, and any skill the job asks for that you haven't confirmed is shown as a gap instead of being added.",
  },
  {
    q: "Are the resumes ATS-friendly?",
    a: "They're designed to be: a single column, standard section headings, simple bullets, real selectable text and no tables, graphics or text boxes. Different applicant tracking systems parse documents differently, so no one can honestly guarantee compatibility with every ATS.",
  },
  {
    q: "What if a job site blocks the link?",
    a: "Some sites require a login or block automated access. We never try to bypass those restrictions. Paste the job description instead and everything else works the same way.",
  },
  {
    q: "Who can see my CV and documents?",
    a: "Only you. Files are stored privately and protected by row-level security in the database. Platform administrators see aggregate usage numbers, not your CV, documents or notes, unless you explicitly grant temporary support access from your settings.",
  },
  {
    q: "Does ApplyDesk submit applications for me?",
    a: "No. You download your documents and apply through the original advertisement. You also stay in control of your tracker: an application is only marked as submitted when you say so.",
  },
  {
    q: "Can I export or delete my data?",
    a: "Yes. From Settings you can download everything in your account as a JSON file, and permanently delete your account and all associated files at any time.",
  },
];

function HeroMock() {
  const rows = [
    { req: "WordPress development", ev: "5 years at Kiwi Digital", m: "Strong", c: "bg-mint-50 text-mint-700 ring-mint-200" },
    { req: "JavaScript (ES6+)", ev: "Listed across 3 roles", m: "Strong", c: "bg-mint-50 text-mint-700 ring-mint-200" },
    { req: "React", ev: "Side project only", m: "Partial", c: "bg-sun-50 text-sun-700 ring-sun-200" },
    { req: "AWS certification", ev: "No evidence in profile", m: "Gap", c: "bg-coral-50 text-coral-700 ring-coral-200" },
  ];
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-grape-200/70 via-bloom-100/60 to-sun-100/60 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-24px_rgba(63,42,168,0.45)]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Senior Web Developer</p>
            <p className="truncate text-xs text-muted-foreground">Harbour &amp; Co · Auckland · Full-time</p>
          </div>
          <span className="rounded-full bg-coral-50 px-2 py-0.5 text-xs font-medium text-coral-700 ring-1 ring-inset ring-coral-200">Interview</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between rounded-lg bg-accent px-3 py-2">
            <p className="text-xs font-medium text-accent-foreground">Overall fit: Good match</p>
            <p className="text-xs text-accent-foreground/80">9 of 12 requirements evidenced</p>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[1.1fr_1.2fr_auto] gap-2 bg-muted/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
              <span>Job requirement</span>
              <span>Your evidence</span>
              <span>Match</span>
            </div>
            {rows.map((r) => (
              <div key={r.req} className="grid grid-cols-[1.1fr_1.2fr_auto] items-center gap-2 border-t px-3 py-2 text-xs">
                <span className="truncate font-medium">{r.req}</span>
                <span className="truncate text-muted-foreground">{r.ev}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${r.c}`}>{r.m}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: FileText, label: "Resume v3", tone: "bloom" as Tone },
              { icon: ScrollText, label: "Cover letter", tone: "ocean" as Tone },
              { icon: MessagesSquare, label: "12 questions", tone: "mint" as Tone },
            ].map(({ icon: Icon, label, tone }) => (
              <div key={label} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs">
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-md ${TILE[tone]}`}>
                  <Icon className="size-3" />
                </span>
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Illustrative example</p>
    </div>
  );
}

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const deleted = (await searchParams).deleted === "1";
  return (
    <>
      {deleted ? (
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <p role="status" className="rounded-lg border border-mint-200 bg-mint-50 px-4 py-3 text-sm text-mint-700">
            Your account and all associated data have been permanently deleted.
          </p>
        </div>
      ) : null}
      {/* Hero */}
      <div className="bg-aurora">
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-grape-100 bg-card px-3 py-1 text-xs font-medium text-grape-700 shadow-[0_1px_2px_rgba(63,42,168,0.08)]">
            <Sparkles className="size-3.5 text-coral-600" /> AI-assisted, fact-checked against your profile
          </p>
          <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Your next career move starts with a <span className="text-gradient">better application.</span>
          </h1>
          <p className="max-w-xl text-pretty text-lg text-muted-foreground">
            Create tailored resumes, write compelling cover letters and manage your job search in one intelligent workspace.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Get started <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#features">Explore features</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-mint-600" /> DOCX &amp; PDF downloads</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-mint-600" /> Private by default</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-mint-600" /> No invented experience</li>
          </ul>
        </div>
        <HeroMock />
      </section>
      </div>

      {/* Value proposition */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
          {[
            { k: "One advertisement", v: "Paste a job link and get a complete workspace for that role: analysis, documents, prep and tracking." },
            { k: "One profile", v: "Your verified experience is the single source of truth. Every document is generated from it, so you never start from scratch." },
            { k: "Every application", v: "Know what's due, who to follow up with and where each opportunity stands, from saved to offer." },
          ].map((item, i) => (
            <div key={item.k} className="space-y-2">
              <span aria-hidden className={`mb-3 block h-1 w-10 rounded-full ${["bg-grape-500", "bg-bloom-500", "bg-sun-400"][i]}`} />
              <p className="text-sm font-semibold text-brand">{item.k}</p>
              <p className="text-[15px] leading-relaxed text-foreground/85">{item.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="mb-10 max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <p className="text-muted-foreground">From job advertisement to tailored application in minutes, with you reviewing every step.</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className={`flex size-9 items-center justify-center rounded-lg ${TILE[STEP_TONES[i]!]}`}>
                  <s.icon className="size-4.5" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="text-[15px] font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section id="features" className="bg-ink-panel scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight">Everything you need to apply professionally</h2>
            <p className="text-white/75">A complete application toolkit, not just a resume builder.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
                <span className={`mb-3 flex size-9 items-center justify-center rounded-lg ${TILE[FEATURE_TONES[i]!]}`}>
                  <f.icon className="size-4.5" />
                </span>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-white/65">
            Plus application emails, LinkedIn and CV summaries, answers to common application questions, skill-gap analysis and follow-up emails.
          </p>
        </div>
      </section>

      {/* Benefits / integrity */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight">Persuasive, and still accurate</h2>
          <p className="text-muted-foreground">
            Recruiters can spot exaggeration, and it can cost you an offer. ApplyDesk is built to present your real experience at its best,
            with safeguards that keep every claim traceable to your profile.
          </p>
          <ul className="space-y-3">
            {integrity.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[15px]">
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-mint-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Briefcase, t: "Save hours per application", b: "Stop rewriting your resume from scratch for every role.", tone: "sun" as Tone },
            { icon: Target, t: "Apply with clarity", b: "Know your strengths and gaps before you hit submit.", tone: "coral" as Tone },
            { icon: Lock, t: "Private by design", b: "Your files are private, encrypted in transit and isolated per account.", tone: "ocean" as Tone },
            { icon: ShieldCheck, t: "You stay in control", b: "Review, edit and approve everything. Nothing is sent on your behalf.", tone: "mint" as Tone },
          ].map(({ icon: Icon, t, b, tone }) => (
            <div key={t} className="rounded-xl border bg-card p-5">
              <span className={`mb-3 flex size-9 items-center justify-center rounded-lg ${TILE[tone]}`}>
                <Icon className="size-4.5" />
              </span>
              <p className="font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example workflow */}
      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="mb-8 text-3xl font-semibold tracking-tight">An example workflow</h2>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { t: "Monday 9:00", h: "Find a role", b: "Paste a Senior Web Developer listing. ApplyDesk extracts 12 requirements and 18 ATS keywords." },
              { t: "Monday 9:05", h: "Review the fit", b: "Strong on WordPress and JavaScript; React flagged as partial. You add a React project you'd forgotten." },
              { t: "Monday 9:15", h: "Tailor and download", b: "Generate a resume and a concise cover letter, tweak two bullets, and download both as PDF." },
              { t: "Thursday", h: "Prepare to impress", b: "Invited to interview. Practise twelve role-specific questions with STAR answers from your own work." },
            ].map((s, i) => (
              <div key={s.h} className={`space-y-2 border-l-2 pl-4 ${["border-grape-400", "border-bloom-400", "border-coral-400", "border-mint-400"][i]}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.t}</p>
                <p className="font-semibold">{s.h}</p>
                <p className="text-sm text-muted-foreground">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="mb-8 text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="divide-y rounded-xl border bg-card">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="flex size-6 items-center justify-center rounded-full bg-grape-50 text-grape-700 transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="bg-ink-panel mx-auto max-w-6xl overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12">
          <h2 className="text-balance text-3xl font-semibold tracking-tight">Make your next application your best one.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/75">
            Set up your profile once and create tailored, professional applications for every role you want.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="brand">
              <Link href="/register">
                Create your free account <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:border-white/40 hover:bg-white/10 hover:text-white">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

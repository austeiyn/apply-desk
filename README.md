# ApplyDesk

**One job advertisement. One intelligent application workspace. Everything needed to apply professionally.**

ApplyDesk is a multi-user web application for managing a job search: candidates build a verified career profile (or import it from their CV), paste a job advertisement link, see a transparent requirements analysis, generate tailored ATS-friendly resumes and cover letters, prepare for interviews and track every application from saved to offer. Administrators manage the platform without access to candidates' private content.

- [Features](#features)
- [Architecture](#architecture)
- [Local development](#local-development)
- [Testing](#testing)
- [Configuration](#configuration)
- [Deployment](docs/DEPLOYMENT.md) · [Administration](docs/ADMIN.md) · [Security model](docs/SECURITY.md)
- [Limitations and future work](#limitations-and-future-work)

---

## Features

**Candidates**
- Registration with email verification, login/logout, password reset, email and password change.
- Guided onboarding; full career profile (personal details, summary and preferences, experience, education, skills, certifications, projects, training, awards, volunteering, publications) with a completion score.
- CV upload (PDF/DOCX) direct to private storage → server-side validation and text extraction → AI extraction → **review screen** where the user chooses what to import. Existing details are never silently overwritten. Multiple master CV versions with a primary CV and private downloads.
- **Create application**: server-side job-advertisement retrieval (schema.org `JobPosting` + page extraction) with SSRF protection, and a manual fallback when sites block automated access.
- **Job analysis**: requirements matrix mapping each requirement to evidence in the profile (*Strong / Partial / Not evidenced / Missing qualification*), strengths, gaps, ATS keywords, employer phrases, clarifying questions and an overall suitability assessment (explicitly not a hiring prediction).
- **Tailored resumes**: generated from the verified profile; employers, titles, dates and qualifications are copied from the user's records by reference. Unevidenced skills become *skill gaps*; figures not found in the profile are flagged. Editor with live preview, section reordering/hiding, bullet editing, per-section AI regeneration, version history with compare and restore.
- **Cover letters** in five tones, with editor, regeneration and downloads.
- **DOCX and PDF downloads**: single-column, standard headings, real selectable text, no tables, text boxes, graphics or header/footer content.
- **Toolkit**: application email with attachment checklist, LinkedIn/CV summaries, answers to common application questions (with placeholders for facts only the user knows), skill-gap analysis with a learning plan, and follow-up emails (follow-up, thank-you, update request, interview reply, accept/decline offer).
- **Interview preparation**: technical, behavioural, situational, experience and company questions with STAR answers from real evidence; honest notes where no evidence exists; private notes.
- **Tracker**: Kanban (drag and drop + accessible status menu) and table views, filters (all, active, interviews, offers, rejected, saved), search, deadlines, follow-ups, recruiter details, interviews, notes and a timeline. Status is only ever changed by the user.
- **Dashboard**: summary stats, recent applications, upcoming actions, weekly activity chart, profile completion and quick actions.
- **Privacy controls**: JSON data export, self-service account deletion, and optional time-limited read-only support access.

**Administrators**
- Overview (aggregate stats, activity chart, system and AI health), user directory (search, filters, activity counts), suspend/reactivate, audited deletion, applications analytics, AI usage by feature and model, announcements, platform settings (registration, AI switch and per-user limits) and an append-only audit log.
- Admins **cannot** read candidates' CVs, documents, notes or applications unless the user grants temporary support access; even then the view is read-only and audit-logged.

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| UI | Tailwind CSS v4, shadcn/ui-style components on Radix primitives, Lucide icons, Sonner, Recharts, dnd-kit |
| Forms | React Hook Form + Zod (the same schemas validate on the server) |
| Backend | Server Components, Server Actions, Route Handlers, `proxy.ts` for session refresh |
| Data | Supabase Postgres with Row Level Security on every table, Supabase Auth, private Supabase Storage |
| AI | Anthropic TypeScript SDK, Claude (`claude-opus-5-5` by default), structured JSON outputs validated with Zod |
| Documents | `docx` for Word, `pdf-lib` + embedded Liberation Sans (Arial-metric, OFL) for PDF, `unpdf`/`mammoth` for CV text extraction, `cheerio` for job pages |
| Hosting | Netlify (OpenNext adapter) + Supabase |

```
app/
  (marketing)/      landing, privacy, terms          (auth)/  login, register, verify, reset
  onboarding/       guided setup                     dashboard/  candidate workspace
  admin/            admin console                    api/  AI (streaming), documents, job import, export
lib/
  ai/               client, prompts, guard (quotas), job-analyser, resume-generator,
                    cover-letter-generator, interview-preparation, application-assistant, cv-extractor
  jobs/             SSRF-safe fetcher (net-guard, fetch-page) and job extraction
  resume/           content model, assembly from AI output, integrity checks
  documents/        DOCX/PDF renderers sharing one layout model
  supabase/ auth/ data/ validation/
supabase/migrations  schema, RLS, storage, admin functions
tests/              unit, db (RLS against real Supabase), e2e (Playwright + mock Anthropic API)
```

**AI requests** run only on the server through `lib/ai/client.ts`, which enforces the AI switch, per-user daily/monthly quotas, a burst limit and a duplicate-request lock; sends one shared system prompt carrying the integrity and prompt-injection rules; wraps candidate data and job advertisements as untrusted, tag-delimited data; requests a JSON schema; handles refusals, truncation and API errors; and meters every request. Long generations stream progress over NDJSON so connections stay alive.

## Local development

**Prerequisites:** Node.js 20.9+ (22 recommended), Docker, and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install
```

```bash
supabase start
```

`supabase start` runs Postgres, Auth, Storage and Mailpit locally and applies every migration in `supabase/migrations`. Copy the printed values into `.env.local`:

```bash
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` (the API URL, usually `http://127.0.0.1:54321`), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and optionally `ANTHROPIC_API_KEY`. Then:

```bash
npm run dev
```

Open http://localhost:3000 and register. Verification and password-reset emails are captured by Mailpit at http://127.0.0.1:54324. To make yourself an administrator:

```bash
npm run admin:grant -- you@example.com
```

Other useful scripts: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:types` (regenerate `lib/db/database.types.ts` after schema changes).

## Testing

| Suite | Command | What it covers |
|---|---|---|
| Unit | `npm test` | SSRF guard (IP encodings, redirects, DNS rebinding, compression bombs), job extraction, AI client (structured output, refusals, truncation, error mapping, metering), integrity rules, document rendering (PDF/DOCX text round-trip, ATS structure) |
| Database | `npm run test:db` | 39 tests against the local Supabase stack: user isolation, admin boundaries, support-access consent, suspension, immutable audit log, resume versioning, storage privacy, registration lock, deletion cascade, plus schema invariants (RLS on every table, pinned `search_path`, grants) |
| End to end | `npm run test:e2e` | Playwright suites (69 checks): auth with real verification emails, CV import with prompt-injection content, the full application workflow, admin console, account export/deletion, mobile layouts, location pre-fill and the AI hand-off to the edge runner |

The end-to-end suites start a small **mock of the Anthropic Messages API** (`tests/e2e/mock-anthropic.mjs`) so the real SDK code path runs without spending tokens. Its fixtures deliberately include integrity traps (an unsupported "strong" match, a skill the user doesn't have, an invented metric, an unknown role) that the app must neutralise. Run the app against it with:

```bash
ANTHROPIC_API_KEY=test-key ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev
```

and then, in another terminal:

```bash
npm run test:e2e
```

## Configuration

All variables are documented in [`.env.example`](.env.example). Platform-level settings (registration, AI on/off, per-user AI limits, max CV files, support email) are edited at **Admin → Platform Settings** and stored in the database.

## Limitations and future work

- **Netlify function time limits.** AI routes stream progress to keep connections open, but a single generation must finish within your Netlify plan's function execution limit. If long generations time out, set `ANTHROPIC_FAST_MODE=true` or a faster `ANTHROPIC_MODEL`. Moving generation to background jobs (Netlify background functions or a queue) is the next step for very long outputs.
- **Job import** reads public pages only and never bypasses logins or bot protection; JavaScript-only job boards and sites that block automated access need the paste fallback.
- **Scanned (image-only) CVs** aren't OCR'd; users are asked for a text-based PDF or DOCX.
- **Single resume template.** The ATS-safe template is deliberate; additional templates and A4/Letter switching would be straightforward on the shared layout model.
- **Single language (English)** and NZD-style date formatting.
- **No billing.** Usage is controlled by admin-configurable quotas.
- **Legal pages are drafts** and must be reviewed by a qualified adviser before launch.
- Ideas: email reminders for follow-ups and deadlines, calendar export for interviews, browser extension for saving jobs, multi-factor authentication for admins, OCR for scanned CVs.

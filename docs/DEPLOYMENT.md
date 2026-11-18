# Deploying ApplyDesk (Supabase + Netlify)

This guide takes you from an empty Supabase project to a live Netlify site on your own domain. Allow about 30–45 minutes.

## 1. Create the Supabase project

1. At [supabase.com](https://supabase.com) create a new project. Choose the region closest to your users (for New Zealand and Australia: **Sydney / ap-southeast-2**) and save the database password.
2. **Apply the database migrations** (schema, Row Level Security, private storage bucket, admin functions). Either:
   - **Supabase CLI (recommended):** from the repository root run `supabase link --project-ref <your-project-ref>`, then `supabase db push`.
   - **SQL editor:** open each file in `supabase/migrations/` **in filename order** and run it in Dashboard → SQL Editor.
3. Confirm the bucket exists: Storage should show a **private** bucket named `source-cvs`.

## 2. Configure Supabase Auth

Dashboard → Authentication:

| Setting | Value |
|---|---|
| **URL Configuration → Site URL** | `https://your-domain.com` (your final public URL) |
| **URL Configuration → Redirect URLs** | `https://your-domain.com/**` (add `https://<your-site>.netlify.app/**` and `http://localhost:3000/**` if you use them) |
| **Sign In / Providers → Email** | Enabled, **Confirm email** on |
| **Passwords** | Minimum length 8; require letters and digits |
| **Rate limits** | Defaults are fine; ApplyDesk adds its own per-IP limits |

**Email templates** (Authentication → Emails → Templates). ApplyDesk verifies links on the server at `/auth/confirm` using the `token_hash` flow, which works even when a link is opened in a different browser. Replace the link in these templates (the full HTML is in `supabase/templates/`):

| Template | Link |
|---|---|
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` |
| Change email address | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/dashboard/settings` |

(If you keep Supabase's default templates, `/auth/confirm` also accepts the PKCE `code` they produce, but the token-hash links are more reliable.)

**SMTP:** Supabase's built-in email sender is only for testing and is heavily rate-limited. Before launch, configure a provider under Authentication → Emails → SMTP Settings (e.g. Postmark, Resend, SendGrid, Amazon SES) with a sender address on your domain.

**API keys:** Project Settings → API Keys. Copy the **Publishable key** and the **Secret key** (or the legacy `anon` and `service_role` keys).

## 3. Get an Anthropic API key

At [console.anthropic.com](https://console.anthropic.com) create an API key (Settings → API Keys) and add credit. Consider setting a monthly spend limit in the Console as a backstop to ApplyDesk's per-user quotas. ApplyDesk works without a key; AI features then show a setup notice.

## 4. Put the code on GitHub

Create an empty GitHub repository, then from the project directory:

```bash
git remote add origin https://github.com/<you>/applydesk.git
```

```bash
git push -u origin main
```

`.env.local` is git-ignored; never commit secrets.

## 5. Create the Netlify site

1. Netlify → **Add new site → Import an existing project** → GitHub → choose the repository.
2. Build settings are read from `netlify.toml` (`npm run build`, publish `.next`, Node 22). Netlify detects Next.js and installs its runtime automatically.
3. **Environment variables** (Site configuration → Environment variables), before the first deploy:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Needed at build time |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key | Needed at build time |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret (service_role) key | Mark as **secret**; Functions scope is enough |
| `ANTHROPIC_API_KEY` | Anthropic key | Mark as **secret** |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | *(optional on Netlify)* No trailing slash. Defaults to the site's Netlify address; set it once you use a custom domain |
| `ANTHROPIC_MODEL` | *(optional)* | Default `claude-opus-5-5` |
| `ANTHROPIC_FAST_MODE` | *(optional)* `true` | Faster generation, premium pricing |

`NEXT_PUBLIC_*` values are compiled into the site and into its Content Security Policy, so **redeploy after changing them**.

4. Deploy. When it finishes, open the site and register.

If the two `NEXT_PUBLIC_SUPABASE_*` variables are missing, the build stops straight away with a message naming them. Add them and choose **Deploys → Trigger deploy → Deploy site**.

## 6. Custom domain

1. Netlify → Domain management → **Add a domain** and follow the DNS instructions. Netlify provisions HTTPS automatically.
2. Set `NEXT_PUBLIC_APP_URL` to the final `https://` URL and **redeploy** (this also enables HSTS and `upgrade-insecure-requests`).
3. Update Supabase **Site URL** and **Redirect URLs** to the same domain.

## 7. Create your administrator account

Register on the live site and verify your email, then promote the account using either:

- **Supabase SQL editor:** `select public.grant_admin_role('you@example.com');`
- **From your machine:** with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set for the production project, run `npm run admin:grant -- you@example.com`

Sign out and back in, and open `/admin`. See [ADMIN.md](ADMIN.md).

## 8. Post-deployment checklist

- [ ] Register a test account; the verification email arrives and its link opens onboarding.
- [ ] Password reset email works end to end.
- [ ] Upload a CV (PDF and DOCX) and review the extracted data.
- [ ] Paste a job link from a public job board; if it can't be retrieved, the paste fallback appears.
- [ ] Generate a resume and cover letter; download both formats and open them.
- [ ] Admin → Overview shows **System health** all green.
- [ ] Admin → Platform Settings: set AI limits and a support email.
- [ ] Replace the bracketed placeholders in `/privacy` and `/terms` after legal review.

## How AI requests run on Netlify

Netlify serverless functions stop after about 30 seconds, and most AI generations take longer. ApplyDesk therefore splits each AI request into three steps, which the browser drives automatically:

1. **Prepare** (Next.js route, serverless): checks the user, quota and rate limits, builds the prompt, stores it in the `ai_runs` table and returns a one-time ticket.
2. **Wait for Claude** (edge function `netlify/edge-functions/ai-run.ts` at `/api/ai-run`): claims the ticket, calls Claude and stores the raw reply. Edge functions only need to start responding within about 40 seconds and can then keep streaming, so long generations are fine. They read `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which must include the **Functions** scope (the default).
3. **Finish** (the same Next.js route again): validates the reply, applies the integrity rules, saves the result and deletes the stored prompt.

`ai_runs` is only accessible to the service role; rows are deleted when used and abandoned ones after an hour. On a host without a function time limit you can set `AI_RUNNER=inline` to call Claude directly from the route instead.

**Upgrading an existing project:** run any new files in `supabase/migrations/` (for example `20261118000100_ai_runs.sql`) in the SQL editor, in filename order, before or right after deploying.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Netlify build fails with "ApplyDesk build stopped: missing environment variable(s)" | Add the named variables in Netlify → Project configuration → Environment variables, then trigger a new deploy. |
| Email links go to `localhost` | Supabase **Site URL** still points at localhost. |
| "Link invalid or expired" after clicking a verification email | Redirect URL not allow-listed, or the email template link wasn't updated. |
| AI features show "aren't configured" | `ANTHROPIC_API_KEY` missing; redeploy after adding it. |
| AI requests fail with "Something went wrong" right away after an upgrade | A new migration (e.g. `ai_runs`) hasn't been run in Supabase yet. |
| "The connection ended before the AI finished" | The edge function didn't deploy or can't read its environment variables; check Netlify → Logs → Edge Functions. |
| "AI usage metering isn't configured" | `SUPABASE_SERVICE_ROLE_KEY` missing. |
| CV upload fails in the browser | `NEXT_PUBLIC_SUPABASE_URL` changed without a redeploy (the CSP still allows the old origin). |
| Admin console returns 404 | The account isn't an admin, or you need to sign out and in again after granting the role. |

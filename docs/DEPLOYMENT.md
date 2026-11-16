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
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | No trailing slash; needed at build time |
| `ANTHROPIC_MODEL` | *(optional)* | Default `claude-opus-5-5` |
| `ANTHROPIC_FAST_MODE` | *(optional)* `true` | Faster generation, premium pricing |

`NEXT_PUBLIC_*` values are compiled into the site and into its Content Security Policy, so **redeploy after changing them**.

4. Deploy. When it finishes, open the site and register.

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

## Function time limits and AI generation

AI routes stream progress events while Claude works, which keeps proxies and browsers from closing idle connections. The total generation time must still fit within your Netlify plan's **function execution limit**; check Netlify's current documentation for your plan. Typical generations take 20–60 seconds. If you see timeouts:

1. set `ANTHROPIC_FAST_MODE=true` (supported on `claude-opus-5-5`), and/or
2. set `ANTHROPIC_MODEL` to a faster model (e.g. `claude-sonnet-5-5`), and/or
3. upgrade the Netlify plan or move generation to background functions.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Email links go to `localhost` | Supabase **Site URL** still points at localhost. |
| "Link invalid or expired" after clicking a verification email | Redirect URL not allow-listed, or the email template link wasn't updated. |
| AI features show "aren't configured" | `ANTHROPIC_API_KEY` missing; redeploy after adding it. |
| "AI usage metering isn't configured" | `SUPABASE_SERVICE_ROLE_KEY` missing. |
| CV upload fails in the browser | `NEXT_PUBLIC_SUPABASE_URL` changed without a redeploy (the CSP still allows the old origin). |
| Admin console returns 404 | The account isn't an admin, or you need to sign out and in again after granting the role. |

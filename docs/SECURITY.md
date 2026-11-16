# Security model

ApplyDesk stores sensitive personal and career information. Controls are layered so that a mistake in one layer is caught by another.

## Authentication and sessions
- Supabase Auth with email verification required before sign-in; minimum 8-character passwords containing letters and digits.
- Sessions live in HTTP-only cookies managed by `@supabase/ssr`; `proxy.ts` refreshes them on each request and responses for signed-in users are marked `private, no-store`.
- Every server component, server action and route handler re-verifies the user (`getClaims()` plus a profile lookup) and the account status. The proxy redirect is a convenience, never the control.
- Login, registration, password reset, verification resend, email change and account deletion are rate-limited per IP and per account (Postgres-backed, so limits hold across serverless instances).
- No account enumeration: registration and password reset respond identically whether or not an account exists.
- Post-login redirects accept only same-origin relative paths (open-redirect protection).
- Sign-out is POST-only with an Origin check.

## Authorisation (defence in depth)
1. **Row Level Security on every table** (verified by a test that fails if any public table lacks RLS). Owner policies require `auth.uid() = user_id` **and** an active account, so suspension cuts off data access immediately.
2. **Composite foreign keys** `(parent_id, user_id)` make it impossible to link a row to another user's application or resume even with a guessed UUID.
3. **Column-level grants**: users can update only `full_name`, `avatar_url`, `onboarding_completed_at` and `support_access_expires_at` on `profiles`; a trigger additionally rejects changes to role or status. Signup metadata is never trusted for roles.
4. **Server code** additionally filters every query by `user_id` and validates IDs before use. Unknown IDs return 404, not "forbidden".
5. **Admins** use `SECURITY DEFINER` functions that check `is_admin()` and return only aggregates or account-level fields; they have no RLS access to candidate content. The only exception is the consented, time-limited, read-only support policy, which the user controls.
6. System-maintained tables (resume versions, application timeline status events, AI usage, audit log) can't be forged by users; the audit log is append-only even for admins.
7. Service-only functions (rate limiting, admin role changes) can't be executed by `anon` or `authenticated`.

## Files
- CVs are uploaded straight from the browser to a **private** bucket under `<user_id>/…`; storage RLS restricts every operation to the owner's folder, and the bucket only accepts PDF/DOCX up to 10 MB.
- The server then re-validates the real file type from its magic bytes, size and readability, and deletes anything invalid.
- Downloads use 60-second signed URLs created after an ownership check. Admins have no storage access.
- Generated documents are rendered on demand from stored content, so no stale copies of personal data accumulate.

## Job advertisement retrieval (SSRF)
- Only `http`/`https`, default ports, no embedded credentials and no internal hostnames (`localhost`, `.local`, `.internal`, …).
- Every DNS answer is checked **inside the socket's lookup function**, so the validated address is the one connected to (no DNS rebinding). Private, loopback, link-local (including cloud metadata), CGNAT, multicast, reserved, IPv4-mapped/NAT64/6to4 IPv6 forms and decimal/hex/octal IP encodings are blocked.
- Redirects are followed manually (maximum 5) and each hop is re-validated.
- 12-second overall deadline; 3 MB limit measured after decompression (compression-bomb safe); HTML only.
- An honest bot User-Agent is used. Logins, paywalls, CAPTCHAs and 401/403 responses are reported, never bypassed.
- Extracted content is converted to plain text; third-party HTML is never rendered.

## AI safety and integrity
- All AI calls run server-side through one client; API keys never reach the browser.
- Candidate data, CV text and job advertisements are passed as **untrusted, tag-delimited data**; delimiter tags inside the content are neutralised so it can't break out. A shared system prompt instructs the model never to follow instructions inside them.
- Outputs use JSON schemas and are validated with Zod before anything is saved; refusals and truncated responses are handled explicitly.
- **Integrity is enforced in code, not just in the prompt:** resume employers, titles, dates, institutions, qualifications and certification names come from the user's records by reference; unknown references are dropped; skills not evidenced in the profile become "skill gaps"; figures not present in the profile are flagged; analysis matches without evidence are downgraded; STAR answers without evidence are flagged.
- Cost protection: an admin master switch, per-user daily and 30-day quotas, a per-minute burst limit, a duplicate-request lock, prompt size limits and metering of every request.

## Web security
- Content Security Policy (`default-src 'self'`; scripts limited to self plus inline bootstrap; `connect-src` limited to the Supabase project; `frame-ancestors 'none'`; `object-src 'none'`), `X-Frame-Options: DENY`, `nosniff`, a strict `Referrer-Policy`, `Permissions-Policy`, COOP, and HSTS plus `upgrade-insecure-requests` on HTTPS.
- React escapes all output; the app uses no `dangerouslySetInnerHTML`. User-supplied URLs are restricted to `http(s)` before being used as links, which open with `rel="noopener noreferrer nofollow"`.
- JSON route handlers require a same-origin `Origin` header (CSRF); server actions use Next.js's built-in origin checks.
- Errors shown to users are generic; details go to server logs only.

## Secrets
- `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are read only in modules marked `server-only`, which can't be bundled for the browser.
- `.env*` files are git-ignored (except `.env.example`).

## Privacy
- Users can export all of their data (JSON) and permanently delete their account and files at any time.
- Admin actions (suspension, deletion, support views, settings and announcement changes, role changes) are audited.

## Reporting a vulnerability
Email the platform owner at the support address configured in Admin → Platform Settings. Please don't open public issues for security problems.

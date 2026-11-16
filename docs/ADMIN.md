# Administration guide

## Granting and removing the administrator role

Administrator status is stored in `profiles.role` and **cannot be changed from the application**: users have no database permission to update that column, a trigger rejects any attempt, and signup metadata is ignored. Admins are promoted only by functions that just the database owner or the service role can execute.

**Grant** (the user must have registered first):

```sql
select public.grant_admin_role('you@example.com');
```

or, with production credentials in your environment:

```bash
npm run admin:grant -- you@example.com
```

**Revoke:**

```sql
select public.revoke_admin_role('someone@example.com');
```

Both are written to the audit log. Admin pages return **404** to everyone else.

## What administrators can and can't see

| Visible | Not visible |
|---|---|
| Name, email, registration date, status, last activity | CV files and extracted text |
| Counts of applications, documents and AI requests | Resumes, cover letters, interview prep, toolkit outputs |
| Platform-wide aggregates and AI token usage | Application details, notes, recruiter contacts |
| Audit log | Prompts sent to the AI or its responses |

This is enforced by Row Level Security, not just the UI: admin pages use database functions that return only aggregates and account-level fields.

### Support access (with the user's consent)

A user can grant temporary, read-only support access (24 hours, 3 days or 7 days) from **Settings → Support access**, and revoke it at any time. While it's active, **Admin → Users → (user) → Open read-only support view** shows their profile summary and application list (not notes). Every view is recorded as `support.viewed` in the audit log.

## Managing users

- **Suspend:** requires a reason. The user is signed out, blocked from signing in (auth-level ban) and loses all data access immediately (RLS). Their data is kept.
- **Reactivate:** restores access.
- **Delete:** requires typing the user's email and recording a reason (e.g. "User requested deletion by email on 3 May"). This permanently deletes the account, all rows and stored files. Use it only when the user asks or your retention policy requires it; users can also delete their own accounts from Settings.
- Admins can't suspend or delete themselves or other admins (revoke the role first).

## Data retention

| Event | What happens |
|---|---|
| User deletes a document, CV or application | Removed immediately (CV files are removed from storage). |
| User or admin deletes the account | Profile, career data, applications, documents, versions, notes and files are deleted immediately. |
| Kept after deletion | Anonymous AI usage rows (user link removed) for aggregate statistics; audit-log entries referencing the deleted user's ID. |

Document this policy in your privacy notice.

## Platform settings

**Admin → Platform Settings** (every change is audited):

- **Open registration:** close it to pause new sign-ups (also enforced in the database).
- **Enable AI features:** a master switch for all AI generation.
- **Requests per user per day / per 30 days:** quotas protecting your Anthropic spend. Failed requests aren't counted; 0 means unlimited.
- **Max stored CV files per user.**
- **Support email:** shown to users on the Settings and suspension pages.

## Announcements

Publish information, success or warning banners to every candidate's workspace, optionally scheduled with start and end times. Users can dismiss them per browser.

## Monitoring costs

**Admin → AI Usage** shows requests, failures and input/output tokens by feature and model. Pair it with a monthly spend limit in the Anthropic Console.

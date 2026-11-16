-- =============================================================================
-- Authentication hooks, role protection, helper functions and Row Level Security
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions used by policies.
-- SECURITY DEFINER so they can read public.profiles without recursing through
-- its RLS policies. They only ever answer questions about the *calling* user
-- (auth.uid()), so they cannot be used to probe other accounts.
-- -----------------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and account_status = 'active'
  );
$$;

-- True when the caller is an active admin AND the target user has granted
-- temporary support access. This is the ONLY path by which an administrator
-- can read a candidate's private workspace, and it is read-only.
create or replace function public.has_support_access(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.profiles
    where id = target and support_access_expires_at > now()
  );
$$;

revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.has_support_access(uuid) from public, anon;
grant execute on function public.is_active_user() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.has_support_access(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- New user provisioning. Role is ALWAYS 'candidate': user-supplied metadata is
-- never trusted for authorisation. Admins are promoted only via
-- public.grant_admin_role(), which only the database owner/service role can run.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open jsonb;
begin
  select value into v_open from public.platform_settings where key = 'registration_open';
  -- app_metadata can only be written with the service role, so this bypass is
  -- available to trusted server code (e.g. an admin-created account) only.
  if v_open = 'false'::jsonb
     and coalesce(new.raw_app_meta_data ->> 'bypass_registration_lock', 'false') <> 'true' then
    raise exception 'Registration is currently closed' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 200)
  );
  insert into public.candidate_profiles (user_id, contact_email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when a user confirms an email change.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Profile column protection (defence in depth on top of column grants below).
-- -----------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Trusted contexts (service role, database owner, SECURITY DEFINER admin
  -- functions) run as a role other than anon/authenticated.
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.account_status is distinct from old.account_status
       or new.status_reason is distinct from old.status_reason
       or new.status_changed_at is distinct from old.status_changed_at
       or new.email is distinct from old.email
       or new.created_at is distinct from old.created_at then
      raise exception 'You are not allowed to modify these account fields' using errcode = '42501';
    end if;
    if new.support_access_expires_at is not null
       and new.support_access_expires_at > now() + interval '7 days 1 minute' then
      raise exception 'Support access can be granted for at most 7 days' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Promote/demote admins. Not executable by anon or authenticated users: run it
-- from the Supabase SQL editor or with the service role (see docs/ADMIN.md).
create or replace function public.grant_admin_role(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.profiles
     set role = 'admin'
   where lower(email) = lower(btrim(p_email))
  returning id into v_id;
  if v_id is null then
    raise exception 'No account found for %', p_email using errcode = 'P0002';
  end if;
  insert into public.audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (null, 'admin.role_granted', 'user', v_id::text, jsonb_build_object('via', 'grant_admin_role'));
  return v_id;
end;
$$;

create or replace function public.revoke_admin_role(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.profiles
     set role = 'candidate'
   where lower(email) = lower(btrim(p_email)) and role = 'admin'
  returning id into v_id;
  if v_id is null then
    raise exception 'No admin account found for %', p_email using errcode = 'P0002';
  end if;
  insert into public.audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (null, 'admin.role_revoked', 'user', v_id::text, jsonb_build_object('via', 'revoke_admin_role'));
  return v_id;
end;
$$;

revoke execute on function public.grant_admin_role(text) from public, anon, authenticated;
revoke execute on function public.revoke_admin_role(text) from public, anon, authenticated;
grant execute on function public.grant_admin_role(text) to service_role;
grant execute on function public.revoke_admin_role(text) to service_role;

-- Throttled "last seen" update, callable by the signed-in user for themselves.
create or replace function public.touch_last_active()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles
     set last_active_at = now()
   where id = auth.uid()
     and (last_active_at is null or last_active_at < now() - interval '15 minutes');
$$;
revoke execute on function public.touch_last_active() from public, anon;
grant execute on function public.touch_last_active() to authenticated;

-- -----------------------------------------------------------------------------
-- Table privileges
-- Supabase grants broad privileges to anon/authenticated by default; RLS is the
-- primary control, but we also remove privileges that are never needed.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- profiles: users may only update a small set of their own columns.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, avatar_url, onboarding_completed_at, support_access_expires_at)
  on public.profiles to authenticated;

-- System-maintained tables: read-only (or no access) for end users.
revoke insert, update, delete on public.resume_versions from authenticated;
revoke insert, update, delete on public.ai_usage from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke all on public.rate_limits from authenticated;
revoke update, delete on public.application_events from authenticated;

-- Public read of non-sensitive platform settings (e.g. registration_open).
grant select on public.platform_settings to anon;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.work_experiences enable row level security;
alter table public.education enable row level security;
alter table public.skills enable row level security;
alter table public.certifications enable row level security;
alter table public.projects enable row level security;
alter table public.profile_extras enable row level security;
alter table public.source_cvs enable row level security;
alter table public.job_applications enable row level security;
alter table public.application_events enable row level security;
alter table public.interviews enable row level security;
alter table public.generated_resumes enable row level security;
alter table public.resume_versions enable row level security;
alter table public.generated_cover_letters enable row level security;
alter table public.interview_preparations enable row level security;
alter table public.application_materials enable row level security;
alter table public.ai_usage enable row level security;
alter table public.announcements enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

-- profiles --------------------------------------------------------------------
-- Users read their own row (even when suspended, so the app can explain why).
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

-- Admins can read account-level fields for user management. Candidate career
-- data lives in other tables that admins cannot read.
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id and (select public.is_active_user()))
  with check ((select auth.uid()) = id);

-- Owner-scoped tables: full CRUD for the active owner, read-only support view
-- for admins only while the owner has granted support access.
do $$
declare
  t text;
begin
  foreach t in array array[
    'candidate_profiles', 'work_experiences', 'education', 'skills',
    'certifications', 'projects', 'profile_extras', 'source_cvs',
    'job_applications', 'interviews', 'generated_resumes',
    'generated_cover_letters', 'interview_preparations', 'application_materials'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select auth.uid()) = user_id and (select public.is_active_user()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id and (select public.is_active_user()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select auth.uid()) = user_id and (select public.is_active_user()))
         with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id and (select public.is_active_user()))',
      t || '_delete_own', t);
  end loop;

  -- Support-access read policies (subset of tables useful for support).
  foreach t in array array[
    'candidate_profiles', 'work_experiences', 'education', 'skills',
    'certifications', 'projects', 'job_applications', 'generated_resumes',
    'generated_cover_letters'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select public.has_support_access(user_id)))',
      t || '_select_support', t);
  end loop;
end;
$$;

-- candidate_profiles is created by the signup trigger; never deleted directly.
drop policy candidate_profiles_delete_own on public.candidate_profiles;
drop policy candidate_profiles_insert_own on public.candidate_profiles;

-- application_events: owners read their timeline and may add app-level events;
-- 'created' and 'status_changed' are reserved for the database trigger.
create policy application_events_select_own on public.application_events
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_active_user()));
create policy application_events_insert_own on public.application_events
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.is_active_user())
    and event_type not in ('created', 'status_changed')
  );
-- No update/delete: the timeline is removed only by cascade with its application.

-- resume_versions: read-only history for the owner.
create policy resume_versions_select_own on public.resume_versions
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_active_user()));

-- ai_usage: users can see their own metering; writes are server-side only.
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- announcements: everyone signed in sees currently active announcements;
-- admins manage them.
create policy announcements_select_active on public.announcements
  for select to authenticated
  using (is_active and starts_at <= now() and (ends_at is null or ends_at > now()));
create policy announcements_admin_all on public.announcements
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- platform_settings: readable by all, writable by admins.
create policy platform_settings_select_all on public.platform_settings
  for select to anon, authenticated
  using (true);
create policy platform_settings_update_admin on public.platform_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
revoke insert, delete on public.platform_settings from authenticated;

-- audit_logs: admins read; nobody writes directly (functions / service role).
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select public.is_admin()));

-- rate_limits: no policies -> no access except service role.

-- Audit every platform setting change.
create or replace function public.platform_settings_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.value is distinct from old.value then
    insert into public.audit_logs (actor_user_id, actor_email, action, target_type, target_id, metadata)
    values (
      auth.uid(),
      (select email from public.profiles where id = auth.uid()),
      'settings.updated', 'platform_setting', new.key,
      jsonb_build_object('from', old.value, 'to', new.value)
    );
  end if;
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger platform_settings_audit
  before update on public.platform_settings
  for each row execute function public.platform_settings_audit();

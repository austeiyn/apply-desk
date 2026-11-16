-- =============================================================================
-- Private storage, administrator functions and rate limiting
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Storage: private bucket for uploaded master CVs.
-- Objects must live under "<auth.uid()>/..." and are never publicly readable.
-- Downloads use short-lived signed URLs created server-side after an
-- ownership check.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'source-cvs', 'source-cvs', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy source_cvs_objects_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'source-cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  );

create policy source_cvs_objects_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'source-cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  );

create policy source_cvs_objects_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'source-cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  )
  with check (
    bucket_id = 'source-cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy source_cvs_objects_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'source-cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  );

-- -----------------------------------------------------------------------------
-- Rate limiting (fixed window). Service role only: exposing it to users would
-- let them exhaust other users' buckets.
-- -----------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else r.count + 1
        end,
        window_start = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start
        end
  returning count into v_count;

  -- Opportunistic cleanup of stale counters.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- Administrator functions
-- All are SECURITY DEFINER, verify public.is_admin() first, and return only
-- account-level fields or aggregate counts - never CV text, generated
-- documents, notes or other private application content.
-- -----------------------------------------------------------------------------
create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator privileges required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'total_candidates', (select count(*) from public.profiles where role = 'candidate'),
    'total_admins', (select count(*) from public.profiles where role = 'admin'),
    'suspended_users', (select count(*) from public.profiles where account_status = 'suspended'),
    'active_users_7d', (select count(*) from public.profiles where last_active_at > now() - interval '7 days'),
    'active_users_30d', (select count(*) from public.profiles where last_active_at > now() - interval '30 days'),
    'new_users_this_month', (select count(*) from public.profiles where created_at >= date_trunc('month', now())),
    'new_users_last_month', (select count(*) from public.profiles
                               where created_at >= date_trunc('month', now()) - interval '1 month'
                                 and created_at < date_trunc('month', now())),
    'onboarded_users', (select count(*) from public.profiles where onboarding_completed_at is not null),
    'total_applications', (select count(*) from public.job_applications),
    'total_resumes', (select count(*) from public.generated_resumes),
    'total_cover_letters', (select count(*) from public.generated_cover_letters),
    'total_interview_preps', (select count(*) from public.interview_preparations),
    'total_source_cvs', (select count(*) from public.source_cvs),
    'total_ai_requests', (select count(*) from public.ai_usage),
    'ai_requests_30d', (select count(*) from public.ai_usage where created_at > now() - interval '30 days'),
    'ai_errors_30d', (select count(*) from public.ai_usage where status <> 'success' and created_at > now() - interval '30 days'),
    'avg_applications_per_user', (
      select coalesce(round(count(a.*)::numeric / nullif((select count(*) from public.profiles where role = 'candidate'), 0), 2), 0)
      from public.job_applications a)
  ) into v;
  return v;
end;
$$;

-- Daily activity series for charts.
create or replace function public.admin_activity_series(p_days integer default 30)
returns table (
  day date,
  registrations bigint,
  applications bigint,
  resumes bigint,
  cover_letters bigint,
  ai_requests bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
  with days as (
    select generate_series(
      (current_date - (greatest(least(p_days, 365), 1) - 1)),
      current_date,
      interval '1 day'
    )::date as d
  )
  select
    days.d,
    (select count(*) from public.profiles p where p.created_at::date = days.d),
    (select count(*) from public.job_applications a where a.created_at::date = days.d),
    (select count(*) from public.generated_resumes r where r.created_at::date = days.d),
    (select count(*) from public.generated_cover_letters c where c.created_at::date = days.d),
    (select count(*) from public.ai_usage u where u.created_at::date = days.d)
  from days
  order by days.d;
end;
$$;

create or replace function public.admin_application_status_breakdown()
returns table (application_status text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
  select a.application_status, count(*)
  from public.job_applications a
  group by a.application_status
  order by count(*) desc;
end;
$$;

create or replace function public.admin_ai_usage_by_feature(p_days integer default 30)
returns table (
  feature text,
  requests bigint,
  errors bigint,
  input_tokens bigint,
  output_tokens bigint,
  avg_duration_ms numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
  select
    u.feature,
    count(*),
    count(*) filter (where u.status <> 'success'),
    coalesce(sum(u.input_tokens), 0)::bigint,
    coalesce(sum(u.output_tokens), 0)::bigint,
    round(avg(u.duration_ms)::numeric, 0)
  from public.ai_usage u
  where u.created_at > now() - make_interval(days => greatest(least(p_days, 365), 1))
  group by u.feature
  order by count(*) desc;
end;
$$;

create or replace function public.admin_ai_usage_by_model(p_days integer default 30)
returns table (model text, requests bigint, input_tokens bigint, output_tokens bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
  select
    coalesce(u.model, 'unknown'),
    count(*),
    coalesce(sum(u.input_tokens), 0)::bigint,
    coalesce(sum(u.output_tokens), 0)::bigint
  from public.ai_usage u
  where u.created_at > now() - make_interval(days => greatest(least(p_days, 365), 1))
  group by coalesce(u.model, 'unknown')
  order by count(*) desc;
end;
$$;

-- Searchable user directory with per-user activity totals (counts only).
create or replace function public.admin_list_users(
  p_search text default null,
  p_status text default null,
  p_created_from date default null,
  p_created_to date default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  account_status text,
  status_reason text,
  created_at timestamptz,
  last_active_at timestamptz,
  onboarding_completed_at timestamptz,
  support_access_expires_at timestamptz,
  application_count bigint,
  document_count bigint,
  ai_request_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public.assert_admin();
  if v_search is not null then
    -- Escape LIKE wildcards in user input.
    v_search := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with filtered as (
    select p.*
    from public.profiles p
    where (v_search is null or p.email ilike v_search or p.full_name ilike v_search)
      and (p_status is null or p_status = '' or p.account_status = p_status or (p_status = 'admin' and p.role = 'admin'))
      and (p_created_from is null or p.created_at >= p_created_from)
      and (p_created_to is null or p.created_at < p_created_to + 1)
  )
  select
    f.id, f.email, f.full_name, f.role, f.account_status, f.status_reason,
    f.created_at, f.last_active_at, f.onboarding_completed_at, f.support_access_expires_at,
    (select count(*) from public.job_applications a where a.user_id = f.id),
    (select count(*) from public.generated_resumes r where r.user_id = f.id)
      + (select count(*) from public.generated_cover_letters c where c.user_id = f.id),
    (select count(*) from public.ai_usage u where u.user_id = f.id),
    count(*) over ()
  from filtered f
  order by f.created_at desc
  limit greatest(least(p_limit, 100), 1)
  offset greatest(p_offset, 0);
end;
$$;

-- Suspend / reactivate. Admins cannot change their own status or another
-- admin's status (demote first via revoke_admin_role).
create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
begin
  perform public.assert_admin();
  if p_status not in ('active', 'suspended') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change the status of your own account' using errcode = '42501';
  end if;
  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_target.role = 'admin' then
    raise exception 'Administrator accounts cannot be suspended here' using errcode = '42501';
  end if;
  if v_target.account_status = p_status then
    return;
  end if;

  update public.profiles
     set account_status = p_status,
         status_reason = case when p_status = 'suspended' then left(nullif(btrim(p_reason), ''), 500) else null end,
         status_changed_at = now()
   where id = p_user_id;

  insert into public.audit_logs (actor_user_id, actor_email, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    case when p_status = 'suspended' then 'user.suspended' else 'user.reactivated' end,
    'user', p_user_id::text,
    jsonb_build_object('reason', left(nullif(btrim(p_reason), ''), 500))
  );
end;
$$;

-- Generic audit entry for admin actions performed by server code
-- (e.g. account deletion, support-access views).
create or replace function public.admin_log_action(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  insert into public.audit_logs (actor_user_id, actor_email, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    left(p_action, 100), left(p_target_type, 50), left(p_target_id, 100),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.assert_admin()',
    'public.admin_platform_stats()',
    'public.admin_activity_series(integer)',
    'public.admin_application_status_breakdown()',
    'public.admin_ai_usage_by_feature(integer)',
    'public.admin_ai_usage_by_model(integer)',
    'public.admin_list_users(text, text, date, date, integer, integer)',
    'public.admin_set_account_status(uuid, text, text)',
    'public.admin_log_action(text, text, text, jsonb)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

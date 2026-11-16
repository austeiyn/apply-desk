-- =============================================================================
-- ApplyDesk core schema
-- -----------------------------------------------------------------------------
-- Conventions
--   * Every user-owned table carries `user_id` referencing public.profiles(id)
--     with ON DELETE CASCADE, so deleting an auth user removes all their data.
--   * Child rows that point at another user-owned row use a COMPOSITE foreign
--     key (parent_id, user_id) -> parent(id, user_id). This makes it impossible,
--     at the database level, to attach your row to somebody else's record even
--     if you guess its UUID (defence against IDOR via foreign keys, which are
--     not subject to RLS).
--   * Enumerations are text + CHECK constraints (easier to evolve than enums).
--   * Length limits are enforced here as a backstop to application validation.
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: one row per auth user. Holds account-level data only.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '' check (char_length(email) <= 320),
  full_name text not null default '' check (char_length(full_name) <= 200),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  role text not null default 'candidate' check (role in ('candidate', 'admin')),
  account_status text not null default 'active' check (account_status in ('active', 'suspended')),
  status_reason text check (status_reason is null or char_length(status_reason) <= 500),
  status_changed_at timestamptz,
  onboarding_completed_at timestamptz,
  last_active_at timestamptz,
  -- When set in the future, the user has granted platform admins temporary,
  -- read-only access to their workspace for support purposes.
  support_access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_created_at_idx on public.profiles (created_at desc);
create index profiles_account_status_idx on public.profiles (account_status);
create index profiles_email_lower_idx on public.profiles (lower(email));
create index profiles_last_active_idx on public.profiles (last_active_at desc nulls last);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- candidate_profiles: career profile (1:1 with profiles)
-- -----------------------------------------------------------------------------
create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  professional_title text check (char_length(professional_title) <= 200),
  professional_summary text check (char_length(professional_summary) <= 5000),
  phone text check (char_length(phone) <= 50),
  contact_email text check (char_length(contact_email) <= 320),
  location text check (char_length(location) <= 200),
  country text check (char_length(country) <= 100),
  linkedin_url text check (char_length(linkedin_url) <= 2048),
  portfolio_url text check (char_length(portfolio_url) <= 2048),
  github_url text check (char_length(github_url) <= 2048),
  website_url text check (char_length(website_url) <= 2048),
  years_experience numeric(4, 1) check (years_experience is null or (years_experience >= 0 and years_experience <= 70)),
  current_occupation text check (char_length(current_occupation) <= 200),
  preferred_job_titles text[] not null default '{}' check (cardinality(preferred_job_titles) <= 20),
  preferred_industries text[] not null default '{}' check (cardinality(preferred_industries) <= 20),
  preferred_employment_types text[] not null default '{}' check (cardinality(preferred_employment_types) <= 10),
  preferred_locations text check (char_length(preferred_locations) <= 500),
  work_arrangements text[] not null default '{}'
    check (work_arrangements <@ array['remote', 'hybrid', 'onsite']::text[]),
  salary_expectation text check (char_length(salary_expectation) <= 200),
  -- Resume/cover-letter generation defaults (validated by the application).
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger candidate_profiles_set_updated_at
  before update on public.candidate_profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Profile sections
-- Dates are stored as DATE; month-precision dates use the first of the month.
-- -----------------------------------------------------------------------------
create table public.work_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company text not null check (char_length(company) between 1 and 200),
  job_title text not null check (char_length(job_title) between 1 and 200),
  employment_type text check (employment_type in (
    'full_time', 'part_time', 'contract', 'temporary', 'internship',
    'freelance', 'volunteer', 'apprenticeship', 'other')),
  location text check (char_length(location) <= 200),
  start_date date,
  end_date date,
  is_current boolean not null default false,
  responsibilities text not null default '' check (char_length(responsibilities) <= 10000),
  achievements text not null default '' check (char_length(achievements) <= 10000),
  technologies text[] not null default '{}' check (cardinality(technologies) <= 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_experiences_dates_chk check (end_date is null or start_date is null or end_date >= start_date)
);
create index work_experiences_user_idx on public.work_experiences (user_id, sort_order, start_date desc);
create trigger work_experiences_set_updated_at
  before update on public.work_experiences
  for each row execute function public.set_updated_at();

create table public.education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  institution text not null check (char_length(institution) between 1 and 200),
  qualification text not null check (char_length(qualification) between 1 and 200),
  field_of_study text check (char_length(field_of_study) <= 200),
  start_date date,
  graduation_date date,
  achievements text not null default '' check (char_length(achievements) <= 5000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index education_user_idx on public.education (user_id, sort_order);
create trigger education_set_updated_at
  before update on public.education
  for each row execute function public.set_updated_at();

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill_name text not null check (char_length(skill_name) between 1 and 100),
  skill_category text not null default 'technical'
    check (skill_category in ('technical', 'soft', 'industry', 'tool', 'language', 'other')),
  proficiency text check (proficiency in ('beginner', 'intermediate', 'advanced', 'expert')),
  created_at timestamptz not null default now()
);
create unique index skills_user_name_uidx on public.skills (user_id, lower(skill_name));

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  institution text check (char_length(institution) <= 200),
  issue_date date,
  expiry_date date,
  credential_id text check (char_length(credential_id) <= 200),
  credential_url text check (char_length(credential_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index certifications_user_idx on public.certifications (user_id);
create trigger certifications_set_updated_at
  before update on public.certifications
  for each row execute function public.set_updated_at();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  role text check (char_length(role) <= 200),
  description text not null default '' check (char_length(description) <= 5000),
  technologies text[] not null default '{}' check (cardinality(technologies) <= 100),
  project_url text check (char_length(project_url) <= 2048),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on public.projects (user_id);
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Training, awards, volunteer experience and publications share one shape.
create table public.profile_extras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('training', 'award', 'volunteer', 'publication')),
  title text not null check (char_length(title) between 1 and 300),
  organisation text check (char_length(organisation) <= 200),
  date date,
  description text not null default '' check (char_length(description) <= 5000),
  url text check (char_length(url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profile_extras_user_idx on public.profile_extras (user_id, kind);
create trigger profile_extras_set_updated_at
  before update on public.profile_extras
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- source_cvs: the user's original uploaded CVs (master source documents).
-- The file lives in the private `source-cvs` storage bucket under
-- `<user_id>/<uuid>.<ext>`.
-- -----------------------------------------------------------------------------
create table public.source_cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique check (char_length(storage_path) <= 512),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  label text check (char_length(label) <= 120),
  extracted_text text check (char_length(extracted_text) <= 200000),
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'extracted', 'parsed', 'applied', 'failed')),
  extraction_error text check (char_length(extraction_error) <= 1000),
  -- AI-extracted profile data awaiting user review. Never applied automatically.
  parsed_data jsonb,
  applied_at timestamptz,
  version integer not null default 1 check (version >= 1),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_cvs_path_owner_chk check (split_part(storage_path, '/', 1) = user_id::text)
);
create index source_cvs_user_idx on public.source_cvs (user_id, created_at desc);
create unique index source_cvs_one_primary_uidx on public.source_cvs (user_id) where is_primary;
create trigger source_cvs_set_updated_at
  before update on public.source_cvs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- job_applications: one application workspace per job advertisement.
-- -----------------------------------------------------------------------------
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_title text not null check (char_length(job_title) between 1 and 300),
  company_name text not null default '' check (char_length(company_name) <= 300),
  job_url text check (job_url is null or (char_length(job_url) <= 2048 and job_url ~* '^https?://')),
  source text not null default 'manual' check (source in ('url', 'manual')),
  location text check (char_length(location) <= 300),
  employment_type text check (char_length(employment_type) <= 100),
  salary_range text check (char_length(salary_range) <= 200),
  job_description text not null default '' check (char_length(job_description) <= 60000),
  responsibilities text not null default '' check (char_length(responsibilities) <= 20000),
  required_qualifications text not null default '' check (char_length(required_qualifications) <= 20000),
  required_skills text not null default '' check (char_length(required_skills) <= 20000),
  preferred_qualifications text not null default '' check (char_length(preferred_qualifications) <= 20000),
  application_status text not null default 'interested' check (application_status in (
    'interested', 'preparing', 'ready', 'applied', 'screening',
    'interview', 'assessment', 'offer', 'rejected', 'withdrawn')),
  status_changed_at timestamptz not null default now(),
  application_date date,
  deadline date,
  recruiter_name text check (char_length(recruiter_name) <= 200),
  recruiter_email text check (char_length(recruiter_email) <= 320),
  recruiter_phone text check (char_length(recruiter_phone) <= 50),
  notes text not null default '' check (char_length(notes) <= 20000),
  next_action text check (char_length(next_action) <= 500),
  next_action_date date,
  follow_up_date date,
  offered_salary text check (char_length(offered_salary) <= 200),
  final_outcome text check (char_length(final_outcome) <= 2000),
  job_analysis jsonb,
  analysis_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_applications_id_user_uniq unique (id, user_id)
);
create index job_applications_user_status_idx on public.job_applications (user_id, application_status);
create index job_applications_user_updated_idx on public.job_applications (user_id, updated_at desc);
create index job_applications_user_deadline_idx on public.job_applications (user_id, deadline) where deadline is not null;
create index job_applications_user_followup_idx on public.job_applications (user_id, follow_up_date) where follow_up_date is not null;
create index job_applications_created_idx on public.job_applications (created_at);

create or replace function public.job_applications_track_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.application_status is distinct from old.application_status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger job_applications_set_updated_at
  before update on public.job_applications
  for each row execute function public.set_updated_at();
create trigger job_applications_track_status
  before update of application_status on public.job_applications
  for each row execute function public.job_applications_track_status();

-- Application history (timeline). Written by triggers and the application.
create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid not null,
  event_type text not null check (event_type in (
    'created', 'status_changed', 'analysis_completed', 'resume_generated',
    'cover_letter_generated', 'interview_added', 'interview_prep_generated', 'note')),
  from_status text,
  to_status text,
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  constraint application_events_app_fk foreign key (application_id, user_id)
    references public.job_applications (id, user_id) on delete cascade
);
create index application_events_app_idx on public.application_events (application_id, created_at desc);
create index application_events_user_idx on public.application_events (user_id, created_at desc);

-- SECURITY DEFINER so that 'created' / 'status_changed' events are only ever
-- written by the database itself.
create or replace function public.job_applications_log_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (user_id, application_id, event_type, to_status, description)
    values (new.user_id, new.id, 'created', new.application_status, 'Application created');
  elsif new.application_status is distinct from old.application_status then
    insert into public.application_events (user_id, application_id, event_type, from_status, to_status)
    values (new.user_id, new.id, 'status_changed', old.application_status, new.application_status);
  end if;
  return null;
end;
$$;

create trigger job_applications_log_events
  after insert or update of application_status on public.job_applications
  for each row execute function public.job_applications_log_events();

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid not null,
  scheduled_at timestamptz not null,
  duration_minutes integer check (duration_minutes is null or (duration_minutes > 0 and duration_minutes <= 1440)),
  interview_type text not null default 'video' check (interview_type in (
    'phone', 'video', 'onsite', 'technical', 'panel', 'assessment', 'other')),
  location text check (char_length(location) <= 500),
  interviewers text check (char_length(interviewers) <= 500),
  notes text not null default '' check (char_length(notes) <= 20000),
  outcome text not null default 'pending' check (outcome in ('pending', 'progressed', 'not_progressed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interviews_app_fk foreign key (application_id, user_id)
    references public.job_applications (id, user_id) on delete cascade
);
create index interviews_user_scheduled_idx on public.interviews (user_id, scheduled_at);
create index interviews_app_idx on public.interviews (application_id);
create trigger interviews_set_updated_at
  before update on public.interviews
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Generated documents
-- Documents are rendered to DOCX/PDF on demand from their stored content, so
-- downloads always reflect the latest edits and no stale copies are kept.
-- -----------------------------------------------------------------------------
create table public.generated_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  content_json jsonb not null check (jsonb_typeof(content_json) = 'object'),
  version integer not null default 1 check (version >= 1),
  origin text not null default 'ai' check (origin in ('ai', 'manual', 'duplicate')),
  -- Transient: copied into resume_versions by trigger when content changes.
  last_change_summary text check (char_length(last_change_summary) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generated_resumes_id_user_uniq unique (id, user_id),
  constraint generated_resumes_app_fk foreign key (application_id, user_id)
    references public.job_applications (id, user_id) on delete set null (application_id)
);
create index generated_resumes_user_idx on public.generated_resumes (user_id, updated_at desc);
create index generated_resumes_app_idx on public.generated_resumes (application_id);
create index generated_resumes_created_idx on public.generated_resumes (created_at);
create trigger generated_resumes_set_updated_at
  before update on public.generated_resumes
  for each row execute function public.set_updated_at();

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  resume_id uuid not null,
  version integer not null check (version >= 1),
  content_json jsonb not null,
  change_summary text check (char_length(change_summary) <= 300),
  created_at timestamptz not null default now(),
  constraint resume_versions_resume_fk foreign key (resume_id, user_id)
    references public.generated_resumes (id, user_id) on delete cascade,
  constraint resume_versions_resume_version_uniq unique (resume_id, version)
);
create index resume_versions_resume_idx on public.resume_versions (resume_id, version desc);

-- Version history is maintained by the database so it cannot be skipped.
create or replace function public.generated_resumes_versioning()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version = 1;
    return new;
  end if;
  if new.content_json is distinct from old.content_json then
    new.version = old.version + 1;
  else
    new.version = old.version;
  end if;
  return new;
end;
$$;

-- SECURITY DEFINER: users have no direct write access to resume_versions, so
-- the history can only be produced by this trigger and cannot be forged.
create or replace function public.generated_resumes_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.content_json is distinct from old.content_json then
    insert into public.resume_versions (user_id, resume_id, version, content_json, change_summary)
    values (
      new.user_id, new.id, new.version, new.content_json,
      coalesce(new.last_change_summary, case when tg_op = 'INSERT' then 'Created' else 'Edited' end)
    );
    -- Keep the 50 most recent versions per resume.
    delete from public.resume_versions
    where resume_id = new.id
      and version <= new.version - 50;
  end if;
  return null;
end;
$$;

create trigger generated_resumes_versioning
  before insert or update on public.generated_resumes
  for each row execute function public.generated_resumes_versioning();
create trigger generated_resumes_snapshot
  after insert or update on public.generated_resumes
  for each row execute function public.generated_resumes_snapshot();

create table public.generated_cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  content text not null default '' check (char_length(content) <= 20000),
  tone text not null default 'professional' check (tone in (
    'professional', 'friendly', 'enthusiastic', 'executive', 'concise')),
  version integer not null default 1 check (version >= 1),
  origin text not null default 'ai' check (origin in ('ai', 'manual', 'duplicate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generated_cover_letters_app_fk foreign key (application_id, user_id)
    references public.job_applications (id, user_id) on delete set null (application_id)
);
create index generated_cover_letters_user_idx on public.generated_cover_letters (user_id, updated_at desc);
create index generated_cover_letters_app_idx on public.generated_cover_letters (application_id);
create index generated_cover_letters_created_idx on public.generated_cover_letters (created_at);

create or replace function public.generated_cover_letters_versioning()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content is distinct from old.content then
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

create trigger generated_cover_letters_set_updated_at
  before update on public.generated_cover_letters
  for each row execute function public.set_updated_at();
create trigger generated_cover_letters_versioning
  before update on public.generated_cover_letters
  for each row execute function public.generated_cover_letters_versioning();

create table public.interview_preparations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid not null,
  content_json jsonb not null check (jsonb_typeof(content_json) = 'object'),
  notes text not null default '' check (char_length(notes) <= 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interview_preparations_app_uniq unique (application_id),
  constraint interview_preparations_app_fk foreign key (application_id, user_id)
    references public.job_applications (id, user_id) on delete cascade
);
create index interview_preparations_user_idx on public.interview_preparations (user_id, updated_at desc);
create trigger interview_preparations_set_updated_at
  before update on public.interview_preparations
  for each row execute function public.set_updated_at();

-- Saved outputs of the application toolkit (emails, answers, gap analyses ...)
create table public.application_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid,
  kind text not null check (kind in (
    'application_email', 'follow_up_email', 'application_answers',
    'skill_gap', 'professional_summary')),
  title text not null check (char_length(title) between 1 and 200),
  content_json jsonb not null check (jsonb_typeof(content_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_materials_app_fk foreign key (application_id, user_id)
    references public.job_applications (id, user_id) on delete cascade
);
create index application_materials_user_idx on public.application_materials (user_id, kind, created_at desc);
create index application_materials_app_idx on public.application_materials (application_id);
create trigger application_materials_set_updated_at
  before update on public.application_materials
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Platform tables
-- -----------------------------------------------------------------------------

-- Metering for every AI request. user_id is nulled (not deleted) when an
-- account is removed so aggregate platform statistics stay accurate without
-- retaining personal data.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  feature text not null check (char_length(feature) <= 64),
  model text check (char_length(model) <= 100),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  status text not null default 'success' check (status in ('success', 'error', 'refused')),
  error_code text check (char_length(error_code) <= 100),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_created_idx on public.ai_usage (created_at desc);
create index ai_usage_feature_idx on public.ai_usage (feature, created_at desc);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  message text not null check (char_length(message) between 1 and 2000),
  level text not null default 'info' check (level in ('info', 'success', 'warning')),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_window_chk check (ends_at is null or ends_at > starts_at)
);
create index announcements_active_idx on public.announcements (is_active, starts_at desc);
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.platform_settings (
  key text primary key check (key in (
    'registration_open', 'ai_enabled', 'ai_daily_request_limit',
    'ai_monthly_request_limit', 'max_source_cvs', 'support_email')),
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

insert into public.platform_settings (key, value, description) values
  ('registration_open', 'true'::jsonb, 'Allow new candidates to register.'),
  ('ai_enabled', 'true'::jsonb, 'Master switch for all AI features.'),
  ('ai_daily_request_limit', '40'::jsonb, 'Maximum AI requests per user per rolling 24 hours.'),
  ('ai_monthly_request_limit', '400'::jsonb, 'Maximum AI requests per user per rolling 30 days.'),
  ('max_source_cvs', '10'::jsonb, 'Maximum number of master CV files a user can store.'),
  ('support_email', '""'::jsonb, 'Contact address shown to users for support and privacy requests.');

-- Immutable audit trail of sensitive administrative actions.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_email text check (char_length(actor_email) <= 320),
  action text not null check (char_length(action) between 1 and 100),
  target_type text check (char_length(target_type) <= 50),
  target_id text check (char_length(target_id) <= 100),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The only permitted mutation is the FK action that nulls actor_user_id when
  -- the acting account is deleted (ON DELETE SET NULL).
  if tg_op = 'UPDATE'
     and new.actor_user_id is null
     and old.actor_user_id is not null
     and (to_jsonb(new) - 'actor_user_id') = (to_jsonb(old) - 'actor_user_id') then
    return new;
  end if;
  raise exception 'audit_logs are append-only' using errcode = '42501';
end;
$$;
create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- Fixed-window rate limiting counters (server-side only).
create table public.rate_limits (
  key text primary key check (char_length(key) <= 200),
  window_start timestamptz not null default now(),
  count integer not null default 0
);

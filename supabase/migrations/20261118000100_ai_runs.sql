-- AI runs: hand-off between the app server and the edge function that waits
-- for the model.
--
-- Serverless functions on Netlify stop after about 30 seconds, but many AI
-- generations take longer. The app server prepares and authorises a request
-- and stores it here; an edge function (no wall-clock limit once it is
-- streaming) claims it with a one-time token, calls the model and stores the
-- raw reply; the app server then validates and saves the result and deletes
-- the row.
--
-- Rows hold prompt data (profile, CV text, job advertisement) only briefly.
-- Only the service role can access this table: no RLS policies are defined
-- and no privileges are granted to anon or authenticated.

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null check (char_length(feature) between 1 and 100),
  -- SHA-256 of the exact request, so a stored reply is only ever used for the
  -- request it was generated for.
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  request jsonb not null,
  -- SHA-256 of the one-time token given to the browser; the token itself is
  -- never stored.
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  response jsonb,
  error_code text check (char_length(error_code) <= 100),
  error_message text check (char_length(error_message) <= 2000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index ai_runs_user_created_idx on public.ai_runs (user_id, created_at desc);
create index ai_runs_created_idx on public.ai_runs (created_at);

alter table public.ai_runs enable row level security;
revoke all on table public.ai_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_runs to service_role;

create table public.tawazon_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._-]{3,24}$'),
  email text not null check (email = lower(email)),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tawazon_profiles_username_lower_key
  on public.tawazon_profiles (lower(username));
create unique index tawazon_profiles_email_lower_key
  on public.tawazon_profiles (lower(email));

create table public.tawazon_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.tawazon_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index tawazon_sessions_user_id_idx
  on public.tawazon_sessions (user_id);
create index tawazon_sessions_expires_at_idx
  on public.tawazon_sessions (expires_at);

create table public.tawazon_recovery_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recovery_hash text not null,
  recovery_salt text not null,
  iterations integer not null default 150000 check (iterations between 100000 and 1000000),
  updated_at timestamptz not null default now()
);

create table public.tawazon_training_videos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null check (session_id in ('day-1', 'day-2', 'day-3', 'day-4', 'abs')),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  original_name text not null check (char_length(btrim(original_name)) between 1 and 180),
  object_path text not null unique,
  mime_type text not null check (mime_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  ready_at timestamptz
);

create index tawazon_training_videos_user_session_ready_idx
  on public.tawazon_training_videos (user_id, session_id, created_at)
  where status = 'ready';
create index tawazon_training_videos_user_pending_idx
  on public.tawazon_training_videos (user_id, created_at)
  where status = 'pending';

alter table public.tawazon_profiles enable row level security;
alter table public.tawazon_states enable row level security;
alter table public.tawazon_sessions enable row level security;
alter table public.tawazon_recovery_secrets enable row level security;
alter table public.tawazon_training_videos enable row level security;

create policy tawazon_profiles_select_own
  on public.tawazon_profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy tawazon_profiles_update_own
  on public.tawazon_profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy tawazon_states_select_own
  on public.tawazon_states for select to authenticated
  using ((select auth.uid()) = user_id);
create policy tawazon_states_insert_own
  on public.tawazon_states for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy tawazon_states_update_own
  on public.tawazon_states for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy tawazon_training_videos_select_own
  on public.tawazon_training_videos for select to authenticated
  using ((select auth.uid()) = user_id);
create policy tawazon_training_videos_insert_own
  on public.tawazon_training_videos for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy tawazon_training_videos_update_own
  on public.tawazon_training_videos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy tawazon_training_videos_delete_own
  on public.tawazon_training_videos for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy tawazon_sessions_deny_clients
  on public.tawazon_sessions for all to anon, authenticated
  using (false)
  with check (false);
create policy tawazon_recovery_secrets_deny_clients
  on public.tawazon_recovery_secrets for all to anon, authenticated
  using (false)
  with check (false);

revoke all on public.tawazon_profiles,
  public.tawazon_states,
  public.tawazon_sessions,
  public.tawazon_recovery_secrets,
  public.tawazon_training_videos
from anon, authenticated;

grant select, update on public.tawazon_profiles to authenticated;
grant select, insert, update on public.tawazon_states to authenticated;
grant select, insert, update, delete on public.tawazon_training_videos to authenticated;

grant all on public.tawazon_profiles,
  public.tawazon_states,
  public.tawazon_sessions,
  public.tawazon_recovery_secrets,
  public.tawazon_training_videos
to service_role;

create or replace function public.merge_tawazon_state(p_user_id uuid, p_patch jsonb)
returns public.tawazon_states
language sql
security invoker
set search_path = ''
as $$
  insert into public.tawazon_states (user_id, revision, state, updated_at)
  values (p_user_id, 1, coalesce(p_patch, '{}'::jsonb), now())
  on conflict (user_id) do update
  set revision = public.tawazon_states.revision + 1,
      state = public.tawazon_states.state || excluded.state,
      updated_at = now()
  returning *;
$$;

revoke execute on function public.merge_tawazon_state(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merge_tawazon_state(uuid, jsonb) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tawazon-training-videos',
  'tawazon-training-videos',
  false,
  104857600,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

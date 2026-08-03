alter table public.tawazon_profiles
  add column role text not null default 'user'
    check (role in ('user', 'super_admin'));

create table public.tawazon_activity_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.tawazon_profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) between 2 and 48),
  page text check (page is null or char_length(page) <= 48),
  platform text not null default 'unknown' check (platform in ('web', 'ios', 'android', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index tawazon_activity_events_created_idx on public.tawazon_activity_events (created_at desc);
create index tawazon_activity_events_user_created_idx on public.tawazon_activity_events (user_id, created_at desc);

alter table public.tawazon_activity_events enable row level security;

create table public.tawazon_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.tawazon_profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  category text not null check (category in ('general', 'experience', 'bug', 'feature', 'meals', 'workouts')),
  message text not null check (char_length(message) between 10 and 2000),
  page text check (page is null or char_length(page) <= 48),
  platform text not null default 'unknown' check (platform in ('web', 'ios', 'android', 'unknown')),
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'not_configured', 'failed')),
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tawazon_feedback_created_idx on public.tawazon_feedback (created_at desc);
create index tawazon_feedback_status_created_idx on public.tawazon_feedback (status, created_at desc);

alter table public.tawazon_feedback enable row level security;

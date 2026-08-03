alter table public.tawazon_profiles
  add column workout_mode text not null default 'default'
    check (workout_mode in ('unselected', 'default', 'custom')),
  add column workout_source_user_id uuid references public.tawazon_profiles(id) on delete set null;

create index tawazon_profiles_workout_source_idx
  on public.tawazon_profiles (workout_source_user_id)
  where workout_source_user_id is not null;

update public.tawazon_profiles
set workout_mode = 'custom', workout_source_user_id = null
where lower(username) = 'alisaade';

update public.tawazon_profiles
set workout_mode = 'custom',
    workout_source_user_id = (
      select source.id from public.tawazon_profiles source where lower(source.username) = 'alisaade'
    )
where lower(username) in ('khalil', '7made')
  and exists (select 1 from public.tawazon_profiles source where lower(source.username) = 'alisaade');

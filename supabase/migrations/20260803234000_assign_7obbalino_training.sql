update public.tawazon_profiles
set workout_mode = 'custom',
    workout_source_user_id = (
      select source.id from public.tawazon_profiles source where lower(source.username) = 'alisaade'
    ),
    updated_at = now()
where lower(username) = '7obbalino'
  and exists (select 1 from public.tawazon_profiles source where lower(source.username) = 'alisaade');

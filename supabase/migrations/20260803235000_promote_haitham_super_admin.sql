update public.tawazon_profiles
set role = 'super_admin',
    updated_at = now()
where lower(username) = 'haitham';

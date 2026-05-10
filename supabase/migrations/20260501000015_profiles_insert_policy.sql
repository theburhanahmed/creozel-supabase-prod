-- Migration: Allow users to insert their own profile row
-- Required so the client-side upsert in authService can create a profile
-- for users who were created before the handle_new_user trigger existed,
-- or in any edge case where the trigger did not fire.

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Backfill: create a profile row for any auth user that doesn't have one yet.
-- This is idempotent — on conflict (id) do nothing.
insert into public.profiles (id, display_name, referral_code)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  ),
  upper(substring(md5(u.id::text || random()::text) from 1 for 8))
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

-- Migration: Profiles and Brand Profiles

-- ─── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  display_name  text,
  avatar_url    text,
  bio           text,
  phone         text,
  timezone      text not null default 'UTC',
  notification_preferences jsonb not null default '{}',
  onboarding_completed     bool not null default false,
  referral_code text unique,
  credits       int  not null default 0 check (credits >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Extended user data linked to auth.users. One row per user.';

-- ─── brand_profiles ──────────────────────────────────────────────────────────
create table public.brand_profiles (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade not null,
  brand_name       text,
  logo_url         text,
  voice_guidelines text,
  tone_settings    jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(user_id)
);

comment on table public.brand_profiles is
  'Brand identity settings per user, injected into AI generation prompts.';

-- ─── updated_at trigger helper ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger brand_profiles_updated_at
  before update on public.brand_profiles
  for each row execute procedure public.set_updated_at();

-- ─── auto-create profile on new user ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url, referral_code)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    upper(substring(md5(new.id::text || random()::text) from 1 for 8))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

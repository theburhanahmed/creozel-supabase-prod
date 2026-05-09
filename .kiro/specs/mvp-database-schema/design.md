# Design: MVP Database Schema

## Overview
All schema is delivered as numbered Supabase migration SQL files in `supabase/migrations/`. Migrations run in filename order. The Supabase CLI (`supabase db push` or `supabase migration up`) applies them to the local Docker instance.

## Migration File Structure

```
supabase/
  migrations/
    20260501000001_enums.sql
    20260501000002_profiles.sql
    20260501000003_teams.sql
    20260501000004_content.sql
    20260501000005_social.sql
    20260501000006_pipelines.sql
    20260501000007_media.sql
    20260501000008_credits.sql
    20260501000009_notifications_analytics.sql
    20260501000010_affiliate.sql
    20260501000011_views.sql
    20260501000012_rls.sql
    20260501000013_seed.sql
  config.toml
```

## Schema Design

### Enums (migration 1)
Define all PostgreSQL enums used across tables:
- `team_role`: owner, admin, editor, viewer
- `content_type`: text, image, video, audio
- `job_status`: pending, running, completed, failed
- `post_status`: draft, scheduled, published, failed
- `social_platform`: instagram, youtube, twitter, facebook, linkedin, tiktok
- `pipeline_status`: pending, running, completed, failed
- `media_type`: image, video, audio, document
- `transaction_type`: purchase, deduction, refund, bonus
- `subscription_plan`: free, starter, pro, agency
- `affiliate_status`: pending, paid

### Profiles (migration 2)
```sql
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  bio text,
  phone text,
  timezone text default 'UTC',
  notification_preferences jsonb default '{}',
  onboarding_completed bool default false,
  referral_code text unique,
  credits int default 0 check (credits >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger: auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, avatar_url, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    upper(substring(md5(random()::text) from 1 for 8))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Brand Profiles (migration 2, continued)
```sql
create table public.brand_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  brand_name text,
  logo_url text,
  voice_guidelines text,
  tone_settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);
```

### Teams (migration 3)
```sql
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  logo_url text,
  owner_id uuid references auth.users(id) on delete restrict not null,
  created_at timestamptz default now()
);

create table public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role team_role not null default 'viewer',
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);

create table public.team_invitations (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  email text not null,
  role team_role not null default 'editor',
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz default now()
);
```

### Content (migration 4)
```sql
create table public.content_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  type content_type not null,
  status job_status not null default 'pending',
  prompt text not null,
  result_url text,
  credits_reserved int default 0,
  credits_used int default 0,
  error_message text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.scheduled_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  content text not null,
  platform social_platform not null,
  scheduled_at timestamptz not null,
  status post_status not null default 'draft',
  media_urls text[] default '{}',
  error_message text,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Social (migration 5)
```sql
create table public.social_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  platform social_platform not null,
  account_name text not null,
  account_id text not null,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  is_active bool default true,
  created_at timestamptz default now(),
  unique(team_id, platform, account_id)
);

create table public.webhook_events (
  id uuid default gen_random_uuid() primary key,
  platform social_platform,
  event_type text not null,
  payload jsonb not null default '{}',
  processed_at timestamptz,
  created_at timestamptz default now()
);
```

### Pipelines (migration 6)
```sql
create table public.pipeline_executions (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade,
  pipeline_name text not null,
  status pipeline_status not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  step_failed text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
```

### Media (migration 7)
```sql
create table public.media_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  type media_type not null,
  size_bytes bigint default 0,
  storage_path text not null,
  public_url text,
  thumbnail_url text,
  tags text[] default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
```

### Credits (migration 8)
```sql
create table public.wallets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  reserved int not null default 0 check (reserved >= 0),
  updated_at timestamptz default now(),
  unique(user_id, team_id)
);

-- Trigger: auto-create wallet on profiles insert
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.wallets (user_id, balance)
  values (new.id, 0);
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();

create table public.credit_transactions (
  id uuid default gen_random_uuid() primary key,
  wallet_id uuid references public.wallets(id) on delete cascade not null,
  type transaction_type not null,
  amount int not null check (amount != 0),
  description text,
  reference_id text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table public.pricing_config (
  id uuid default gen_random_uuid() primary key,
  content_type text unique not null,
  credits_cost int not null check (credits_cost > 0),
  is_active bool default true,
  updated_at timestamptz default now()
);

create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  plan subscription_plan not null default 'free',
  status text not null default 'active',
  stripe_subscription_id text,
  razorpay_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Notifications & Analytics (migration 9)
```sql
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text,
  is_read bool default false,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  event_type text not null,
  properties jsonb default '{}',
  created_at timestamptz default now()
);
```

### Affiliate (migration 10)
```sql
create table public.referral_events (
  id uuid default gen_random_uuid() primary key,
  referrer_user_id uuid references auth.users(id) on delete cascade not null,
  referred_email text not null,
  clicked_at timestamptz default now(),
  converted_at timestamptz,
  conversion_value int default 0
);

create table public.affiliate_earnings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount int not null default 0,
  status affiliate_status not null default 'pending',
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz default now()
);
```

### Analytics View (migration 11)
```sql
create or replace view public.analytics_overview as
select
  t.id as team_id,
  count(distinct sp.id) as total_posts,
  count(distinct sp.id) filter (where sp.status = 'published') as published_posts,
  count(distinct sp.id) filter (where sp.status = 'scheduled') as scheduled_posts,
  coalesce(sum(cj.credits_used), 0) as total_credits_used,
  count(distinct pe.id) filter (where pe.status not in ('completed','failed')) as active_pipelines,
  case
    when count(distinct pe.id) = 0 then 0
    else round(
      count(distinct pe.id) filter (where pe.status = 'completed')::numeric /
      count(distinct pe.id)::numeric * 100, 2
    )
  end as pipeline_success_rate
from public.teams t
left join public.scheduled_posts sp on sp.team_id = t.id
left join public.content_jobs cj on cj.team_id = t.id
left join public.pipeline_executions pe on pe.team_id = t.id
group by t.id;
```

### RLS Policies (migration 12)
Each table gets `enable row level security` plus policies:
- `profiles`: user can select/update own row (`auth.uid() = id`)
- `brand_profiles`: user can CRUD own row (`auth.uid() = user_id`)
- `wallets`: user can select own row; service role can update
- `notifications`: user can select/update own rows
- `credit_transactions`: user can select via wallet join
- `teams`: members can select; owner can update/delete
- `team_members`: members can select own team's rows
- `team_invitations`: invited email or team admin can select
- Team-scoped tables (content_jobs, scheduled_posts, social_connections, pipeline_executions, media_items, analytics_events): select/insert/update/delete for team members with appropriate roles
- `pricing_config`: anyone can select; no user insert/update
- `webhook_events`: service role only
- `subscriptions`: user can select own rows

### Seed Data (migration 13)
Insert default `pricing_config` rows:
- text → 5 credits
- image → 10 credits
- video → 20 credits
- audio → 8 credits

## Supabase Config
`supabase/config.toml` configures the local project ID, ports, and auth settings to match the existing `.env`.

## Helper: Team Membership Check
A reusable SQL function used in RLS policies:
```sql
create or replace function public.is_team_member(p_team_id uuid)
returns bool language sql security definer stable as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

create or replace function public.team_member_role(p_team_id uuid)
returns team_role language sql security definer stable as $$
  select role from public.team_members
  where team_id = p_team_id and user_id = auth.uid()
  limit 1;
$$;
```

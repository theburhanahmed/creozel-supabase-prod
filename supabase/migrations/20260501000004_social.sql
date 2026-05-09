-- Migration: Social Connections and Webhook Events
-- Note: social_connections is created before content/scheduled_posts
-- because scheduled_posts has a FK to social_connections.

-- ─── social_connections ──────────────────────────────────────────────────────
create table public.social_connections (
  id                       uuid default gen_random_uuid() primary key,
  user_id                  uuid references auth.users(id) on delete cascade not null,
  team_id                  uuid references public.teams(id) on delete cascade,
  platform                 public.social_platform not null,
  account_name             text not null,
  account_id               text not null,
  access_token_encrypted   text,
  refresh_token_encrypted  text,
  token_expires_at         timestamptz,
  is_active                bool not null default true,
  created_at               timestamptz not null default now(),
  unique(team_id, platform, account_id)
);

comment on table public.social_connections is
  'OAuth-linked social platform accounts. Tokens stored encrypted via Supabase Vault.';

-- ─── webhook_events ──────────────────────────────────────────────────────────
create table public.webhook_events (
  id           uuid default gen_random_uuid() primary key,
  platform     public.social_platform,
  event_type   text not null,
  payload      jsonb not null default '{}',
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.webhook_events is
  'Incoming platform webhook payloads. Written by Edge Functions only.';

-- Index for unprocessed events
create index webhook_events_unprocessed_idx
  on public.webhook_events (created_at)
  where processed_at is null;

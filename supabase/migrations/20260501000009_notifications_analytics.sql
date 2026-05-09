-- Migration: Notifications and Analytics Events

-- ─── notifications ───────────────────────────────────────────────────────────
create table public.notifications (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  type       text not null,
  title      text not null,
  body       text,
  is_read    bool not null default false,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notification feed. Frontend subscribes via Supabase Realtime.';

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where is_read = false;

-- ─── analytics_events ────────────────────────────────────────────────────────
create table public.analytics_events (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  team_id    uuid references public.teams(id) on delete cascade,
  event_type text not null,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.analytics_events is
  'User action tracking for analytics. Append-only.';

create index analytics_events_team_idx
  on public.analytics_events (team_id, event_type, created_at desc);
create index analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc);

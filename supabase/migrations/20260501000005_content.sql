-- Migration: Content Jobs and Scheduled Posts

-- ─── content_jobs ────────────────────────────────────────────────────────────
create table public.content_jobs (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references auth.users(id) on delete cascade not null,
  team_id           uuid references public.teams(id) on delete cascade,
  type              public.content_type not null,
  status            public.job_status not null default 'pending',
  prompt            text not null,
  result_url        text,
  credits_reserved  int not null default 0 check (credits_reserved >= 0),
  credits_used      int not null default 0 check (credits_used >= 0),
  error_message     text,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.content_jobs is
  'AI generation job queue. Frontend subscribes to status changes via Realtime.';

create trigger content_jobs_updated_at
  before update on public.content_jobs
  for each row execute procedure public.set_updated_at();

-- Index for polling active jobs
create index content_jobs_status_idx on public.content_jobs (status, created_at desc);
create index content_jobs_user_idx   on public.content_jobs (user_id, created_at desc);
create index content_jobs_team_idx   on public.content_jobs (team_id, created_at desc);

-- ─── scheduled_posts ─────────────────────────────────────────────────────────
create table public.scheduled_posts (
  id                   uuid default gen_random_uuid() primary key,
  user_id              uuid references auth.users(id) on delete cascade not null,
  team_id              uuid references public.teams(id) on delete cascade,
  content              text not null,
  platform             public.social_platform not null,
  scheduled_at         timestamptz not null,
  status               public.post_status not null default 'draft',
  media_urls           text[] not null default '{}',
  error_message        text,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.scheduled_posts is
  'Posts queued for publishing. Calendar view reads from this table.';

create trigger scheduled_posts_updated_at
  before update on public.scheduled_posts
  for each row execute procedure public.set_updated_at();

-- Indexes for calendar queries
create index scheduled_posts_team_status_idx
  on public.scheduled_posts (team_id, status, scheduled_at);
create index scheduled_posts_scheduled_at_idx
  on public.scheduled_posts (scheduled_at)
  where status = 'scheduled';

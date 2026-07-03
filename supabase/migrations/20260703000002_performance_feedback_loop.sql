-- Migration: Performance feedback loop tables
-- Stores post-level metrics and AI-generated content improvement suggestions.

-- ─── post_performance ───────────────────────────────────────────────────────────
create table public.post_performance (
  id               uuid default gen_random_uuid() primary key,
  scheduled_post_id uuid references public.scheduled_posts(id) on delete cascade not null,
  platform         public.social_platform not null,
  likes            int not null default 0 check (likes >= 0),
  shares           int not null default 0 check (shares >= 0),
  comments         int not null default 0 check (comments >= 0),
  views            int not null default 0 check (views >= 0),
  reach            int not null default 0 check (reach >= 0),
  clicks           int not null default 0 check (clicks >= 0),
  collected_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

comment on table public.post_performance is
  'Engagement metrics for published posts. Populated by platform sync jobs or manual entry.';

create index post_performance_post_idx
  on public.post_performance (scheduled_post_id, collected_at desc);
create index post_performance_platform_idx
  on public.post_performance (platform, collected_at desc);

-- ─── content_suggestions ────────────────────────────────────────────────────────
create table public.content_suggestions (
  id                uuid default gen_random_uuid() primary key,
  team_id           uuid references public.teams(id) on delete cascade not null,
  pipeline_id       uuid references public.pipelines(id) on delete set null,
  content_job_id    uuid references public.content_jobs(id) on delete set null,
  scheduled_post_id uuid references public.scheduled_posts(id) on delete set null,
  suggestion_type   text not null default 'prompt_improvement',
  title             text not null,
  description       text not null,
  prompt_change     text,                         -- optional proposed prompt/template change
  applied           bool not null default false,
  created_at        timestamptz not null default now()
);

comment on table public.content_suggestions is
  'AI-generated improvement recommendations derived from post_performance and content metadata.';

create index content_suggestions_team_idx
  on public.content_suggestions (team_id, applied, created_at desc);

-- ─── RLS policies ───────────────────────────────────────────────────────────────
alter table public.post_performance enable row level security;
alter table public.content_suggestions enable row level security;

create policy "Team members can view post performance"
  on public.post_performance for select
  using (exists (
    select 1 from public.scheduled_posts
    where scheduled_posts.id = scheduled_post_id
      and public.is_team_member(scheduled_posts.team_id)
  ));

create policy "Team members can view content suggestions"
  on public.content_suggestions for select
  using (public.is_team_member(team_id));

create policy "Team editors can manage content suggestions"
  on public.content_suggestions for all
  using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

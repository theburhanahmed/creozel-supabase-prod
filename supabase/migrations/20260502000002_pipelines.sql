-- Migration: pipelines table
-- Task 1.4 — CREATE TABLE with unique constraint and set_updated_at trigger
-- Indexes are added in task 1.5; RLS policies are added in task 1.6.

create table public.pipelines (
  id          uuid        not null default gen_random_uuid() primary key,
  team_id     uuid        not null references public.teams(id) on delete cascade,
  name        text        not null check (char_length(name) between 1 and 100),
  description text        not null default '' check (char_length(description) <= 500),
  schedule    text,
  config      jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (team_id, name)
);

comment on table public.pipelines is
  'Saved Studio configurations that can be triggered manually or on a schedule.';

create trigger pipelines_updated_at
  before update on public.pipelines
  for each row execute procedure public.set_updated_at();

-- Task 1.5 — Index, RLS, and access policies

create index pipelines_team_idx on public.pipelines (team_id, created_at desc);

alter table public.pipelines enable row level security;

create policy "Team members can view pipelines"
  on public.pipelines for select
  using (public.is_team_member(team_id));

create policy "Team editors can insert pipelines"
  on public.pipelines for insert
  with check (public.is_team_editor(team_id));

create policy "Team editors can update pipelines"
  on public.pipelines for update
  using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

create policy "Team admins can delete pipelines"
  on public.pipelines for delete
  using (public.is_team_admin(team_id));

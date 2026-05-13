-- Migration: studio_templates table
-- Task 1.1 — CREATE TABLE with check constraints only
-- Indexes are added in task 1.2; RLS policies are added in task 1.3.

create table public.studio_templates (
  id               uuid        not null default gen_random_uuid() primary key,
  name             text        not null check (char_length(name) between 1 and 100),
  description      text        not null default '' check (char_length(description) <= 500),
  content_category text        not null,
  content_format   text        not null,
  platform         text        not null,
  tone             text        not null,
  prompt_template  text        not null default '',
  advanced_options jsonb       not null default '{}',
  is_system        boolean     not null default false,
  team_id          uuid        references public.teams(id) on delete cascade,
  created_at       timestamptz not null default now()
);

comment on table public.studio_templates is
  'Pre-built and user-saved Studio configuration templates.';

-- Task 1.2 — Indexes
create index studio_templates_team_idx
  on public.studio_templates (team_id, content_category, content_format);

create index studio_templates_system_idx
  on public.studio_templates (is_system, content_category);

-- Task 1.3 — RLS policies
alter table public.studio_templates enable row level security;

-- System templates are readable by all authenticated users;
-- team templates are readable by team members.
create policy "System templates are readable by all authenticated users"
  on public.studio_templates for select
  using (
    is_system = true
    or (team_id is not null and public.is_team_member(team_id))
  );

-- Only team editors may insert (user-saved) templates.
create policy "Team editors can insert templates"
  on public.studio_templates for insert
  with check (
    is_system = false
    and team_id is not null
    and public.is_team_editor(team_id)
  );

-- Only team editors may delete (user-saved) templates.
create policy "Team editors can delete own templates"
  on public.studio_templates for delete
  using (
    is_system = false
    and team_id is not null
    and public.is_team_editor(team_id)
  );

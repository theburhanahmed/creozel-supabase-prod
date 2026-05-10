-- Migration: Teams, Members, Invitations, and Helper Functions

-- ─── extensions ──────────────────────────────────────────────────────────────
-- pgcrypto is required for gen_random_bytes() used in invitation tokens
create extension if not exists pgcrypto with schema extensions;

-- ─── teams ───────────────────────────────────────────────────────────────────
create table public.teams (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  logo_url   text,
  owner_id   uuid references auth.users(id) on delete restrict not null,
  created_at timestamptz not null default now()
);

comment on table public.teams is 'Team workspaces. All resources are scoped to a team.';

-- ─── team_members ─────────────────────────────────────────────────────────────
create table public.team_members (
  id        uuid default gen_random_uuid() primary key,
  team_id   uuid references public.teams(id) on delete cascade not null,
  user_id   uuid references auth.users(id) on delete cascade not null,
  role      public.team_role not null default 'viewer',
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

comment on table public.team_members is 'User membership in teams with role-based access.';

-- ─── team_invitations ────────────────────────────────────────────────────────
create table public.team_invitations (
  id          uuid default gen_random_uuid() primary key,
  team_id     uuid references public.teams(id) on delete cascade not null,
  email       text not null,
  role        public.team_role not null default 'editor',
  token       text unique not null default encode(extensions.gen_random_bytes(32), 'hex'),
  invited_by  uuid references auth.users(id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.team_invitations is 'Pending email invitations to join a team. Expire after 7 days.';

-- ─── helper functions for RLS ─────────────────────────────────────────────────
-- Returns true if the current user is a member of the given team
create or replace function public.is_team_member(p_team_id uuid)
returns bool language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
  );
$$;

-- Returns the current user's role in the given team (null if not a member)
create or replace function public.team_member_role(p_team_id uuid)
returns public.team_role language sql security definer stable set search_path = public as $$
  select role from public.team_members
  where team_id = p_team_id
    and user_id = auth.uid()
  limit 1;
$$;

-- Returns true if the current user has at least editor role in the given team
create or replace function public.is_team_editor(p_team_id uuid)
returns bool language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

-- Returns true if the current user has at least admin role in the given team
create or replace function public.is_team_admin(p_team_id uuid)
returns bool language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

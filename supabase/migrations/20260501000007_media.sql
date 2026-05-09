-- Migration: Media Library

create table public.media_items (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  team_id       uuid references public.teams(id) on delete cascade,
  name          text not null,
  type          public.media_type not null,
  size_bytes    bigint not null default 0 check (size_bytes >= 0),
  storage_path  text not null,
  public_url    text,
  thumbnail_url text,
  tags          text[] not null default '{}',
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

comment on table public.media_items is
  'Media library index. Files stored in Supabase Storage; this table holds metadata.';

create index media_items_team_idx  on public.media_items (team_id, created_at desc);
create index media_items_user_idx  on public.media_items (user_id, created_at desc);
create index media_items_type_idx  on public.media_items (type);
create index media_items_tags_idx  on public.media_items using gin (tags);

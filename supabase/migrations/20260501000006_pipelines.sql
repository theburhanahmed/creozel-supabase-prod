-- Migration: Pipeline Executions

create table public.pipeline_executions (
  id            uuid default gen_random_uuid() primary key,
  team_id       uuid references public.teams(id) on delete cascade,
  pipeline_name text not null,
  status        public.pipeline_status not null default 'pending',
  started_at    timestamptz,
  completed_at  timestamptz,
  error_message text,
  step_failed   text,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

comment on table public.pipeline_executions is
  'n8n workflow run logs. Written by n8n webhooks via Edge Functions.';

create index pipeline_executions_team_idx
  on public.pipeline_executions (team_id, created_at desc);
create index pipeline_executions_status_idx
  on public.pipeline_executions (status, created_at desc);

-- Migration: Tenant-level wallets, pipeline outputs, and unlimited-generation tiers
-- Aligns the schema with the updated PRD direction where the team is the billing
-- boundary and pipelines feed performance data back into future runs.

-- ─── pipeline_outputs ─────────────────────────────────────────────────────────
create table public.pipeline_outputs (
  id                 uuid default gen_random_uuid() primary key,
  execution_id       uuid references public.pipeline_executions(id) on delete cascade not null,
  content_job_id     uuid references public.content_jobs(id) on delete set null,
  media_item_id      uuid references public.media_items(id) on delete set null,
  scheduled_post_id  uuid references public.scheduled_posts(id) on delete set null,
  output_type        text not null default 'content',
  metadata           jsonb not null default '{}',
  created_at         timestamptz not null default now()
);

comment on table public.pipeline_outputs is
  'Links each pipeline execution to the content jobs, media items, and scheduled posts it produced. Enables the feedback loop.';

create index pipeline_outputs_execution_idx
  on public.pipeline_outputs (execution_id, created_at desc);
create index pipeline_outputs_job_idx
  on public.pipeline_outputs (content_job_id);
create index pipeline_outputs_media_idx
  on public.pipeline_outputs (media_item_id);
create index pipeline_outputs_post_idx
  on public.pipeline_outputs (scheduled_post_id);

alter table public.pipeline_outputs enable row level security;

create policy "Team members can view pipeline outputs"
  on public.pipeline_outputs for select
  using (exists (
    select 1 from public.pipeline_executions
    where id = execution_id and public.is_team_member(team_id)
  ));

create policy "Team editors can insert pipeline outputs"
  on public.pipeline_outputs for insert
  with check (exists (
    select 1 from public.pipeline_executions
    where id = execution_id and public.is_team_editor(team_id)
  ));

create policy "Team admins can delete pipeline outputs"
  on public.pipeline_outputs for delete
  using (exists (
    select 1 from public.pipeline_executions
    where id = execution_id and public.is_team_admin(team_id)
  ));

-- ─── unlimited-generation tiers on pricing_config ───────────────────────────
alter table public.pricing_config
  add column if not exists unlimited_for_plans text[] not null default '{}',
  add column if not exists is_unlimited_default bool not null default false;

comment on column public.pricing_config.unlimited_for_plans is
  'List of subscription plan slugs (e.g., pro, agency) that include unlimited generation for this content type.';
comment on column public.pricing_config.is_unlimited_default is
  'When true, all plans treat this content type as unlimited (useful for free text generation). Otherwise use unlimited_for_plans.';

-- ─── team wallet helpers ──────────────────────────────────────────────────────
-- Returns the wallet id for a team, creating it if it does not exist.
create or replace function public.get_or_create_team_wallet(p_team_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wallet_id uuid;
  v_owner_id  uuid;
begin
  select id into v_wallet_id from public.wallets where team_id = p_team_id;
  if v_wallet_id is not null then
    return v_wallet_id;
  end if;

  -- owner_id is required and will be the wallet's user_id for RLS/admin lookups
  select owner_id into v_owner_id from public.teams where id = p_team_id;
  if v_owner_id is null then
    raise exception 'Team % does not exist', p_team_id;
  end if;

  insert into public.wallets (user_id, team_id, balance, reserved)
  values (v_owner_id, p_team_id, 0, 0)
  returning id into v_wallet_id;

  return v_wallet_id;
end;
$$;

-- Trigger: create a team wallet whenever a team is inserted
create or replace function public.handle_new_team()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.get_or_create_team_wallet(new.id);
  return new;
end;
$$;

drop trigger if exists on_team_created on public.teams;
create trigger on_team_created
  after insert on public.teams
  for each row execute procedure public.handle_new_team();

-- Backfill team wallets for existing teams that do not have one yet
insert into public.wallets (user_id, team_id, balance, reserved)
select t.owner_id, t.id, 0, 0
from public.teams t
left join public.wallets w on w.team_id = t.id
where w.id is null;

-- ─── get_wallet_for_scope helper ──────────────────────────────────────────────
-- Returns the wallet id for a team when team_id is provided, otherwise the
-- personal wallet for the user. This is the canonical lookup for billing.
create or replace function public.get_wallet_for_scope(p_user_id uuid, p_team_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wallet_id uuid;
begin
  if p_team_id is not null then
    v_wallet_id := public.get_or_create_team_wallet(p_team_id);
  else
    select id into v_wallet_id
    from public.wallets
    where user_id = p_user_id and team_id is null;
  end if;
  return v_wallet_id;
end;
$$;

-- ─── RLS policies for wallets ─────────────────────────────────────────────────
alter table public.wallets enable row level security;

create policy "Users can view their personal wallet"
  on public.wallets for select
  using (user_id = auth.uid() and team_id is null);

create policy "Team members can view their team wallet"
  on public.wallets for select
  using (team_id is not null and public.is_team_member(team_id));

create policy "Users can update their personal wallet"
  on public.wallets for update
  using (user_id = auth.uid() and team_id is null)
  with check (user_id = auth.uid() and team_id is null);

create policy "Team members can update their team wallet"
  on public.wallets for update
  using (team_id is not null and public.is_team_member(team_id))
  with check (team_id is not null and public.is_team_member(team_id));

-- Note: Service-role Edge Functions bypass RLS and handle final balance/credit_transactions.

-- ─── RLS policies for credit_transactions ────────────────────────────────────
alter table public.credit_transactions enable row level security;

create policy "Users can view transactions for their personal wallet"
  on public.credit_transactions for select
  using (
    exists (
      select 1 from public.wallets
      where wallets.id = credit_transactions.wallet_id
        and wallets.user_id = auth.uid()
        and wallets.team_id is null
    )
  );

create policy "Team members can view transactions for their team wallet"
  on public.credit_transactions for select
  using (
    exists (
      select 1 from public.wallets
      where wallets.id = credit_transactions.wallet_id
        and wallets.team_id is not null
        and public.is_team_member(wallets.team_id)
    )
  );

-- ─── update wallet comment to reflect tenant-level billing boundary ───────────
comment on table public.wallets is
  'Credit balances. In the tenant model, every team has one team wallet; solo users keep a personal wallet (team_id IS NULL). All generation costs for team-scoped resources are charged to the team wallet.';

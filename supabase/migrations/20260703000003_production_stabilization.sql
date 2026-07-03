-- Migration: Production stabilization sprint
-- Fixes wallet RLS conflicts, media soft-delete, social token storage,
-- atomic credit operations, publishing schema, analytics view, and retry tracking.

-- ─── 1. Drop old wallet RLS policies that conflict with tenant-wallet policies ───
drop policy if exists "Users can view own wallet" on public.wallets;
drop policy if exists "Users can update own wallet" on public.wallets;
drop policy if exists "Users can view own credit transactions" on public.credit_transactions;

-- ─── 2. Media soft-delete support ───────────────────────────────────────────────
alter table public.media_items
  add column if not exists deleted_at timestamptz;

-- Update media select policy to hide soft-deleted rows
drop policy if exists "Team members can view media items" on public.media_items;
create policy "Team members can view active media items"
  on public.media_items for select
  using (
    (auth.uid() = user_id or (team_id is not null and public.is_team_member(team_id)))
    and deleted_at is null
  );

-- ─── 3. Social token Vault storage support ──────────────────────────────────────
alter table public.social_connections
  add column if not exists vault_secret_id uuid;

-- ─── 4. Pipeline attribution ───────────────────────────────────────────────────
alter table public.pipelines
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- ─── 5. Retry / publishing metadata on content_jobs ───────────────────────────
alter table public.content_jobs
  add column if not exists retry_count int not null default 0 check (retry_count >= 0),
  add column if not exists retry_at timestamptz,
  add column if not exists last_retry_at timestamptz;

-- ─── 6. Retry / publishing metadata on scheduled_posts ──────────────────────────
alter table public.scheduled_posts
  add column if not exists retry_count int not null default 0 check (retry_count >= 0),
  add column if not exists retry_at timestamptz,
  add column if not exists last_retry_at timestamptz,
  add column if not exists content_hash text,
  add column if not exists pipeline_id uuid references public.pipelines(id) on delete set null,
  add column if not exists content_job_id uuid references public.content_jobs(id) on delete set null,
  add column if not exists platform_post_id text;

-- Deduplication index for scheduled posts
create unique index if not exists scheduled_posts_unique_publish
  on public.scheduled_posts (user_id, platform, content_hash)
  where status != 'failed' and content_hash is not null;

-- ─── 7. Atomic credit operation helpers ─────────────────────────────────────────
-- Reserve credits atomically for a scope. Returns true on success, false on insufficient balance.
create or replace function public.reserve_credits(
  p_user_id uuid,
  p_team_id uuid default null,
  p_amount int default 0
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance int;
begin
  if p_amount <= 0 then
    return true;
  end if;

  v_wallet_id := public.get_wallet_for_scope(p_user_id, p_team_id);
  if v_wallet_id is null then
    return false;
  end if;

  select balance into v_balance
  from public.wallets
  where id = v_wallet_id
  for update;

  if v_balance is null or v_balance < p_amount then
    return false;
  end if;

  update public.wallets
  set reserved = reserved + p_amount
  where id = v_wallet_id;

  return true;
end;
$$;

-- Release reserved credits (e.g., on cancellation or failure before deduction).
create or replace function public.release_credits(
  p_user_id uuid,
  p_team_id uuid default null,
  p_amount int default 0
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  if p_amount <= 0 then
    return;
  end if;

  v_wallet_id := public.get_wallet_for_scope(p_user_id, p_team_id);
  if v_wallet_id is null then
    return;
  end if;

  update public.wallets
  set reserved = greatest(0, reserved - p_amount)
  where id = v_wallet_id;
end;
$$;

-- Deduct credits after successful work and record the transaction atomically.
create or replace function public.deduct_credits(
  p_wallet_id uuid,
  p_amount int default 0,
  p_reserved_release int default 0,
  p_job_id uuid default null,
  p_description text default 'Credit deduction'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 and p_reserved_release <= 0 then
    return;
  end if;

  if p_amount > 0 then
    update public.wallets
    set
      balance = balance - p_amount,
      reserved = greatest(0, reserved - p_reserved_release)
    where id = p_wallet_id
      and balance >= p_amount;

    if not found then
      raise exception 'Insufficient balance for deduction';
    end if;
  else
    update public.wallets
    set reserved = greatest(0, reserved - p_reserved_release)
    where id = p_wallet_id;
  end if;

  insert into public.credit_transactions (wallet_id, type, amount, description, reference_id)
  values (p_wallet_id, 'deduction', -p_amount, p_description, p_job_id);
end;
$$;

-- Add credits (top-up) and record the transaction atomically.
create or replace function public.add_credits(
  p_wallet_id uuid,
  p_amount int default 0,
  p_reference_id uuid default null,
  p_description text default 'Credit top-up',
  p_type text default 'purchase'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    return;
  end if;

  update public.wallets
  set balance = balance + p_amount
  where id = p_wallet_id;

  insert into public.credit_transactions (wallet_id, type, amount, description, reference_id)
  values (p_wallet_id, p_type, p_amount, p_description, p_reference_id);
end;
$$;

-- Refund credits (decrement balance with floor 0) and record the transaction atomically.
create or replace function public.refund_credits(
  p_wallet_id uuid,
  p_amount int default 0,
  p_reference_id uuid default null,
  p_description text default 'Credit refund'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    return;
  end if;

  update public.wallets
  set balance = greatest(0, balance - p_amount)
  where id = p_wallet_id;

  insert into public.credit_transactions (wallet_id, type, amount, description, reference_id)
  values (p_wallet_id, 'refund', -p_amount, p_description, p_reference_id);
end;
$$;

-- ─── 8. Fix analytics_overview solo-user aggregation bug ────────────────────────
create or replace view public.analytics_overview as
-- Team-scoped rows (unchanged)
select
  t.id   as team_id,
  t.name as team_name,
  p.id   as user_id,
  count(distinct sp.id)                                                    as total_posts,
  count(distinct sp.id) filter (where sp.status = 'published')            as published_posts,
  count(distinct sp.id) filter (where sp.status = 'scheduled')            as scheduled_posts,
  count(distinct sp.id) filter (where sp.status = 'draft')                as draft_posts,
  count(distinct sp.id) filter (where sp.status = 'failed')               as failed_posts,
  coalesce(sum(cj.credits_used), 0)                                       as total_credits_used,
  count(distinct cj.id)                                                    as total_jobs,
  count(distinct cj.id) filter (where cj.status = 'completed')            as completed_jobs,
  count(distinct pe.id) filter (
    where pe.status not in ('completed', 'failed')
  )                                                                        as active_pipelines,
  count(distinct pe.id)                                                    as total_pipeline_runs,
  case
    when count(distinct pe.id) = 0 then 0::numeric
    else round(
      count(distinct pe.id) filter (where pe.status = 'completed')::numeric /
      count(distinct pe.id)::numeric * 100,
      2
    )
  end                                                                      as pipeline_success_rate,
  count(distinct sc.id) filter (where sc.is_active = true)                as connected_accounts
from public.teams t
left join public.profiles                p  on p.id = t.owner_id
left join public.scheduled_posts         sp on sp.team_id = t.id
left join public.content_jobs            cj on cj.team_id = t.id
left join public.pipeline_executions     pe on pe.team_id = t.id
left join public.social_connections      sc on sc.team_id = t.id
group by t.id, t.name, p.id

union all

-- Solo user rows (one row per personal user)
select
  null::uuid       as team_id,
  p.display_name   as team_name,
  p.id             as user_id,
  count(distinct sp.id)                                                    as total_posts,
  count(distinct sp.id) filter (where sp.status = 'published')            as published_posts,
  count(distinct sp.id) filter (where sp.status = 'scheduled')            as scheduled_posts,
  count(distinct sp.id) filter (where sp.status = 'draft')                as draft_posts,
  count(distinct sp.id) filter (where sp.status = 'failed')               as failed_posts,
  coalesce(sum(cj.credits_used), 0)                                       as total_credits_used,
  count(distinct cj.id)                                                    as total_jobs,
  count(distinct cj.id) filter (where cj.status = 'completed')            as completed_jobs,
  count(distinct pe.id) filter (
    where pe.status not in ('completed', 'failed')
  )                                                                        as active_pipelines,
  count(distinct pe.id)                                                    as total_pipeline_runs,
  case
    when count(distinct pe.id) = 0 then 0::numeric
    else round(
      count(distinct pe.id) filter (where pe.status = 'completed')::numeric /
      count(distinct pe.id)::numeric * 100,
      2
    )
  end                                                                      as pipeline_success_rate,
  count(distinct sc.id) filter (where sc.is_active = true)                as connected_accounts
from public.profiles p
left join public.scheduled_posts      sp on sp.user_id = p.id and sp.team_id is null
left join public.content_jobs         cj on cj.user_id = p.id and cj.team_id is null
left join public.pipeline_executions  pe on pe.user_id = p.id and pe.team_id is null
left join public.social_connections   sc on sc.user_id = p.id and sc.team_id is null
group by p.id, p.display_name;

comment on view public.analytics_overview is
  'Aggregated dashboard stats per team (or per personal user when team_id IS NULL). Used by the Dashboard and Analytics pages.';

-- ─── 9. Scheduled cron jobs for publishing, metrics sync, and token refresh ───
-- These require the pg_net extension and pg_cron to be enabled in the project.
-- The functions use a shared CRON_SECRET header for authorization.

-- Helper to atomically claim a batch of due scheduled posts.
-- Updates status to 'running' only for rows still marked 'scheduled' and due.
create or replace function public.claim_due_posts(p_limit int default 10)
returns setof public.scheduled_posts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    update public.scheduled_posts
    set status = 'running', updated_at = now()
    where id in (
      select id
      from public.scheduled_posts
      where status = 'scheduled'
        and scheduled_at <= now()
      order by scheduled_at asc
      limit p_limit
      for update skip locked
    )
    returning *
  )
  select * from claimed;
end;
$$;

-- Cron: publish due posts every minute
select cron.schedule(
  'publish-scheduled-posts',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/publish-post',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);

-- Cron: refresh social tokens daily
select cron.schedule(
  'refresh-social-tokens',
  '0 4 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/refresh-social-tokens',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);

-- Cron: sync platform metrics hourly
select cron.schedule(
  'sync-platform-metrics',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);

-- Cron: retry transiently failed content jobs every 5 minutes
select cron.schedule(
  'retry-failed-content-jobs',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/retry-content-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);

-- ─── 10. Team invitation acceptance ─────────────────────────────────────────────
-- Accepts a pending invitation for the currently authenticated user.
-- Validates that the invitation exists, is not expired, and matches the caller's email.
-- Returns the team_id on success.
create or replace function public.accept_team_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.team_invitations%rowtype;
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_existing_role public.team_role;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select email into v_user_email from auth.users where id = v_user_id;

  select * into v_invitation
  from public.team_invitations
  where token = p_token
    and accepted_at is null
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Invitation not found or expired';
  end if;

  if v_invitation.email is distinct from v_user_email then
    raise exception 'Invitation email does not match the current user';
  end if;

  -- If already a member, preserve the higher role and just accept the invitation.
  select role into v_existing_role
  from public.team_members
  where team_id = v_invitation.team_id and user_id = v_user_id;

  if v_existing_role is null then
    insert into public.team_members (team_id, user_id, role)
    values (v_invitation.team_id, v_user_id, v_invitation.role);
  elsif public.role_priority(v_invitation.role) > public.role_priority(v_existing_role) then
    update public.team_members
    set role = v_invitation.role
    where team_id = v_invitation.team_id and user_id = v_user_id;
  end if;

  update public.team_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.team_id;
end;
$$;

-- Helper role priority map used by accept_team_invitation.
create or replace function public.role_priority(p_role public.team_role)
returns int
language sql
immutable
security invoker
set search_path = public
as $$
  select case p_role
    when 'owner'  then 4
    when 'admin'  then 3
    when 'editor' then 2
    when 'viewer' then 1
  end;
$$;

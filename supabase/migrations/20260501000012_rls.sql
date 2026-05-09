-- Migration: Row Level Security Policies
-- Enable RLS on all tables and define access policies.
-- Satisfies: REQ-11.1, REQ-11.2, REQ-11.3, REQ-11.4, REQ-11.5, PROP-3

-- ─── profiles ────────────────────────────────────────────────────────────────
-- REQ-11.2: Users may only read/write their own profiles rows
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── brand_profiles ──────────────────────────────────────────────────────────
-- REQ-11.2: Users may only read/write their own brand_profiles rows
alter table public.brand_profiles enable row level security;

create policy "Users can view own brand profile"
  on public.brand_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own brand profile"
  on public.brand_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own brand profile"
  on public.brand_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own brand profile"
  on public.brand_profiles for delete
  using (auth.uid() = user_id);

-- ─── teams ───────────────────────────────────────────────────────────────────
alter table public.teams enable row level security;

create policy "Team members can view team"
  on public.teams for select
  using (public.is_team_member(id));

create policy "Authenticated users can create teams"
  on public.teams for insert
  with check (auth.uid() = owner_id);

create policy "Team owner can update team"
  on public.teams for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Team owner can delete team"
  on public.teams for delete
  using (auth.uid() = owner_id);

-- ─── team_members ─────────────────────────────────────────────────────────────
alter table public.team_members enable row level security;

-- PROP-3: members can only see rows for teams they belong to
create policy "Team members can view membership"
  on public.team_members for select
  using (public.is_team_member(team_id));

create policy "Team admins can insert members"
  on public.team_members for insert
  with check (public.is_team_admin(team_id));

create policy "Team admins can update members"
  on public.team_members for update
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

create policy "Team admins can delete members"
  on public.team_members for delete
  using (public.is_team_admin(team_id));

-- ─── team_invitations ────────────────────────────────────────────────────────
alter table public.team_invitations enable row level security;

-- Invited user can view their own invitation by matching email
create policy "Invited user can view their invitation"
  on public.team_invitations for select
  using (
    email = (select email from auth.users where id = auth.uid())
    or public.is_team_admin(team_id)
  );

create policy "Team admins can insert invitations"
  on public.team_invitations for insert
  with check (public.is_team_admin(team_id));

create policy "Team admins can update invitations"
  on public.team_invitations for update
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

create policy "Team admins can delete invitations"
  on public.team_invitations for delete
  using (public.is_team_admin(team_id));

-- ─── content_jobs ────────────────────────────────────────────────────────────
-- REQ-11.3: accessible only to members of the relevant team
-- PROP-3: user must never see rows belonging to a team they are not a member of
alter table public.content_jobs enable row level security;

create policy "Team members can view content jobs"
  on public.content_jobs for select
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_member(team_id))
  );

create policy "Team editors can insert content jobs"
  on public.content_jobs for insert
  with check (
    auth.uid() = user_id
    and (team_id is null or public.is_team_editor(team_id))
  );

create policy "Team editors can update content jobs"
  on public.content_jobs for update
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  )
  with check (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  );

create policy "Team editors can delete content jobs"
  on public.content_jobs for delete
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  );

-- ─── scheduled_posts ─────────────────────────────────────────────────────────
-- REQ-11.3: accessible only to members of the relevant team
-- PROP-3: user must never see rows belonging to a team they are not a member of
alter table public.scheduled_posts enable row level security;

create policy "Team members can view scheduled posts"
  on public.scheduled_posts for select
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_member(team_id))
  );

create policy "Team editors can insert scheduled posts"
  on public.scheduled_posts for insert
  with check (
    auth.uid() = user_id
    and (team_id is null or public.is_team_editor(team_id))
  );

create policy "Team editors can update scheduled posts"
  on public.scheduled_posts for update
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  )
  with check (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  );

create policy "Team editors can delete scheduled posts"
  on public.scheduled_posts for delete
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  );

-- ─── social_connections ──────────────────────────────────────────────────────
-- REQ-11.3: accessible only to members of the relevant team
-- PROP-3: user must never see rows belonging to a team they are not a member of
alter table public.social_connections enable row level security;

create policy "Team members can view social connections"
  on public.social_connections for select
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_member(team_id))
  );

create policy "Team editors can insert social connections"
  on public.social_connections for insert
  with check (
    auth.uid() = user_id
    and (team_id is null or public.is_team_editor(team_id))
  );

create policy "Team editors can update social connections"
  on public.social_connections for update
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  )
  with check (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  );

create policy "Team editors can delete social connections"
  on public.social_connections for delete
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  );

-- ─── webhook_events ──────────────────────────────────────────────────────────
-- REQ-11.5: service-role write only; no user-level access
-- With RLS enabled and no permissive policies, all authenticated user access is denied.
-- The service role bypasses RLS by default in Supabase.
alter table public.webhook_events enable row level security;

-- ─── pipeline_executions ─────────────────────────────────────────────────────
-- REQ-11.3: accessible only to members of the relevant team
-- PROP-3: user must never see rows belonging to a team they are not a member of
alter table public.pipeline_executions enable row level security;

create policy "Team members can view pipeline executions"
  on public.pipeline_executions for select
  using (team_id is not null and public.is_team_member(team_id));

create policy "Team editors can insert pipeline executions"
  on public.pipeline_executions for insert
  with check (team_id is not null and public.is_team_editor(team_id));

create policy "Team editors can update pipeline executions"
  on public.pipeline_executions for update
  using (team_id is not null and public.is_team_editor(team_id))
  with check (team_id is not null and public.is_team_editor(team_id));

create policy "Team admins can delete pipeline executions"
  on public.pipeline_executions for delete
  using (team_id is not null and public.is_team_admin(team_id));

-- ─── media_items ─────────────────────────────────────────────────────────────
-- REQ-11.3: accessible only to members of the relevant team
-- PROP-3: user must never see rows belonging to a team they are not a member of
alter table public.media_items enable row level security;

create policy "Team members can view media items"
  on public.media_items for select
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_member(team_id))
  );

create policy "Team editors can insert media items"
  on public.media_items for insert
  with check (
    auth.uid() = user_id
    and (team_id is null or public.is_team_editor(team_id))
  );

create policy "Team editors can update media items"
  on public.media_items for update
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  )
  with check (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  );

create policy "Team editors can delete media items"
  on public.media_items for delete
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_editor(team_id))
  );

-- ─── wallets ─────────────────────────────────────────────────────────────────
-- REQ-11.2: Users may only read their own wallets rows
-- Balance updates handled by service role / Edge Functions only
alter table public.wallets enable row level security;

create policy "Users can view own wallet"
  on public.wallets for select
  using (auth.uid() = user_id);

-- ─── credit_transactions ─────────────────────────────────────────────────────
-- REQ-11.2: Users may only read their own credit_transactions rows (via wallet join)
alter table public.credit_transactions enable row level security;

create policy "Users can view own credit transactions"
  on public.credit_transactions for select
  using (
    wallet_id in (
      select id from public.wallets where user_id = auth.uid()
    )
  );

-- ─── pricing_config ──────────────────────────────────────────────────────────
-- REQ-11.4: publicly readable; only service role may write
alter table public.pricing_config enable row level security;

create policy "Anyone can view pricing config"
  on public.pricing_config for select
  using (true);

-- ─── subscriptions ───────────────────────────────────────────────────────────
-- REQ-11.2: Users may only read their own subscriptions rows
alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ─── notifications ───────────────────────────────────────────────────────────
-- REQ-11.2: Users may only read/write their own notifications rows
alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── analytics_events ────────────────────────────────────────────────────────
-- REQ-11.3: accessible only to members of the relevant team
-- PROP-3: user must never see rows belonging to a team they are not a member of
alter table public.analytics_events enable row level security;

create policy "Team members can view analytics events"
  on public.analytics_events for select
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_member(team_id))
  );

create policy "Authenticated users can insert analytics events"
  on public.analytics_events for insert
  with check (
    auth.uid() = user_id
    and (team_id is null or public.is_team_member(team_id))
  );

-- ─── referral_events ─────────────────────────────────────────────────────────
alter table public.referral_events enable row level security;

create policy "Users can view own referral events"
  on public.referral_events for select
  using (auth.uid() = referrer_user_id);

-- ─── affiliate_earnings ──────────────────────────────────────────────────────
alter table public.affiliate_earnings enable row level security;

create policy "Users can view own affiliate earnings"
  on public.affiliate_earnings for select
  using (auth.uid() = user_id);

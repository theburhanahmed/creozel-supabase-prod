-- ============================================================
-- Creozel Platform — Database Schema
-- Self-hosted Supabase (PostgreSQL 15+)
-- ============================================================
-- This file is loaded by the Supabase DB container on first init.
-- Run `docker-compose down -v && docker-compose up -d` to re-apply.

-- ─── Extensions ──────────────────────────────────────────────
-- pgvector is enabled in vector.sql (already mounted)
-- uuid-ossp for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles ────────────────────────────────────────────────
-- Extends auth.users with app-specific fields.
-- Automatically created on signup via trigger below.
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT,
  username      TEXT UNIQUE,
  avatar_url    TEXT,
  bio           TEXT,
  phone         TEXT,
  timezone      TEXT DEFAULT 'UTC',
  role          TEXT NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('platform_admin','team_owner','team_admin','team_editor','team_viewer','viewer')),
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    LOWER(SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Teams ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  logo_url    TEXT,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer'
               CHECK (role IN ('owner','admin','editor','viewer')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer',
  token       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  invited_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Brand Profiles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  logo_url         TEXT,
  voice_guidelines TEXT,
  tone             TEXT DEFAULT 'professional',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Wallets & Credits ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  reserved   INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create wallet on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id   UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('purchase','deduction','refund','bonus')),
  amount      INTEGER NOT NULL,
  description TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pricing_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL UNIQUE CHECK (content_type IN ('text','image','video','audio')),
  credits_cost INTEGER NOT NULL DEFAULT 1,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default pricing
INSERT INTO public.pricing_config (content_type, credits_cost) VALUES
  ('text',  1),
  ('image', 3),
  ('video', 10),
  ('audio', 2)
ON CONFLICT (content_type) DO NOTHING;

-- ─── Content Jobs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id        UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('text','image','video','audio')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','completed','failed','cancelled')),
  prompt         TEXT NOT NULL,
  parameters     JSONB DEFAULT '{}',
  result_url     TEXT,
  credits_cost   INTEGER NOT NULL DEFAULT 0,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Media Library ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id       UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('image','video','audio','document')),
  size_bytes    BIGINT,
  storage_path  TEXT NOT NULL,
  public_url    TEXT,
  thumbnail_url TEXT,
  tags          TEXT[] DEFAULT '{}',
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Social Connections ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('instagram','youtube','twitter','facebook','linkedin','tiktok')),
  account_name    TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  -- tokens stored encrypted; use Supabase Vault in production
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, platform, account_id)
);

-- ─── Scheduled Posts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  social_connection_id UUID REFERENCES public.social_connections(id) ON DELETE SET NULL,
  platform             TEXT NOT NULL,
  content              TEXT NOT NULL,
  media_urls           TEXT[] DEFAULT '{}',
  scheduled_at         TIMESTAMPTZ NOT NULL,
  published_at         TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','scheduled','published','failed')),
  error_message        TEXT,
  platform_post_id     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Pipelines (Automation) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipelines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  cron_expression  TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  steps            JSONB NOT NULL DEFAULT '[]',
  last_run_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pipeline_executions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id  UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','running','completed','failed')),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms  INTEGER,
  failed_step  TEXT,
  error        TEXT,
  logs         JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Analytics Events ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Post Engagement ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_engagement (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  likes       INTEGER DEFAULT 0,
  comments    INTEGER DEFAULT 0,
  shares      INTEGER DEFAULT 0,
  reach       INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Webhook Events ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  processed   BOOLEAN NOT NULL DEFAULT FALSE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Notifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Affiliate Program ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code       TEXT UNIQUE NOT NULL DEFAULT UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    UUID NOT NULL REFERENCES public.affiliate_links(id) ON DELETE CASCADE,
  referred_user   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','converted','paid')),
  earnings        INTEGER NOT NULL DEFAULT 0,
  attributed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- ─── Row Level Security ──────────────────────────────────────
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_engagement    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Wallets: users can read their own
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT USING (
  auth.uid() = user_id
);

-- Transactions: users can read their own wallet's transactions
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (
  wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
);

-- Content jobs: users can CRUD their own
CREATE POLICY "content_jobs_select_own" ON public.content_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "content_jobs_insert_own" ON public.content_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "content_jobs_update_own" ON public.content_jobs FOR UPDATE USING (auth.uid() = user_id);

-- Teams: members can see their teams
CREATE POLICY "teams_select_member" ON public.teams FOR SELECT USING (
  id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- Team members: members can see other members of their teams
CREATE POLICY "team_members_select" ON public.team_members FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- Scheduled posts: team members can see their team's posts
CREATE POLICY "scheduled_posts_select" ON public.scheduled_posts FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "scheduled_posts_insert" ON public.scheduled_posts FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "scheduled_posts_update" ON public.scheduled_posts FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- Media items: team-scoped
CREATE POLICY "media_items_select" ON public.media_items FOR SELECT USING (
  user_id = auth.uid() OR
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "media_items_insert" ON public.media_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "media_items_delete" ON public.media_items FOR DELETE USING (auth.uid() = user_id);

-- Notifications: own only
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Affiliate links: own only
CREATE POLICY "affiliate_links_select_own" ON public.affiliate_links FOR SELECT USING (auth.uid() = user_id);

-- Pipelines: team-scoped
CREATE POLICY "pipelines_select" ON public.pipelines FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "pipelines_insert" ON public.pipelines FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "pipelines_update" ON public.pipelines FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_content_jobs_user_id    ON public.content_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_content_jobs_status     ON public.content_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_team    ON public.scheduled_posts(team_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status  ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_time    ON public.scheduled_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_media_items_team        ON public.media_items(team_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_team          ON public.pipelines(team_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_team   ON public.analytics_events(team_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user      ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet     ON public.transactions(wallet_id);

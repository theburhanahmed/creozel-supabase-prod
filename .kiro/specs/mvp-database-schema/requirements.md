# Requirements Document

## Introduction

This document defines the requirements for the MVP database schema of Creozel — an AI-powered SaaS content automation platform. The schema consists of PostgreSQL migrations that create all core tables, views, functions, and Row Level Security (RLS) policies from scratch on a self-hosted Supabase instance (PostgreSQL 15+). The schema covers user profiles, team collaboration, AI content generation, social publishing, credit billing, analytics, notifications, and affiliate tracking. All migrations must be idempotent, tested against a clean PostgreSQL instance in CI, and follow the platform's data standards (timestamptz, soft deletes, RLS on every table).

---

## Glossary

- **Migration**: A versioned SQL file applied sequentially to evolve the database schema.
- **RLS**: Row Level Security — PostgreSQL policies enforced by Supabase on every query to isolate data between users and teams.
- **Supabase Vault**: Supabase's encrypted secrets store used to protect OAuth tokens at rest.
- **Wallet**: A row in the `wallets` table representing a user's or team's credit balance.
- **Credit**: The unit of currency for AI generation; reserved at job creation and deducted on completion.
- **ContentJob**: An async AI generation task tracked in the `content_jobs` table.
- **SocialConnection**: An OAuth-linked social platform account stored in `social_connections`.
- **BrandProfile**: A user's brand identity settings stored in `brand_profiles`.
- **Pipeline**: An n8n workflow whose execution is logged in `pipeline_executions`.
- **TeamRole**: One of `owner`, `admin`, `editor`, `viewer` — stored in `team_members.role`.
- **soft delete**: Marking a row as deleted by setting `deleted_at timestamptz` rather than removing it.
- **timestamptz**: PostgreSQL timestamp with time zone, always stored in UTC.
- **analytics_overview**: A PostgreSQL view aggregating content generation volume, post counts, and credit consumption per team.
- **storage_usage**: A PostgreSQL view aggregating total storage bytes consumed per team from `media_items`.

---

## Requirements

### Requirement 1 — Migration Infrastructure

**User Story:** As a platform engineer, I want all schema changes delivered as versioned, sequential SQL migration files, so that the database can be reproduced deterministically from a clean state.

#### Acceptance Criteria

1. THE Migration System SHALL store each migration as a separate `.sql` file under `supabase/migrations/` with a filename prefix of the form `YYYYMMDDHHMMSS_<description>.sql`.
2. THE Migration System SHALL apply migrations in lexicographic filename order so that dependencies between migrations are always satisfied.
3. WHEN a migration is applied to a clean PostgreSQL 15+ instance, THE Migration System SHALL complete without errors.
4. THE Migration System SHALL enable the `pgcrypto` and `uuid-ossp` extensions before any table creation migration runs.
5. IF a migration file contains a syntax error, THEN THE Migration System SHALL halt execution and report the failing filename and line number.

---

### Requirement 2 — User Profiles Table

**User Story:** As a registered user, I want my extended profile data stored and linked to my authentication record, so that the platform can personalise my experience and track my onboarding state.

#### Acceptance Criteria

1. THE Database SHALL contain a `profiles` table with columns: `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `display_name text`, `avatar_url text`, `bio text`, `phone text`, `timezone text`, `notification_preferences jsonb`, `onboarding_completed boolean NOT NULL DEFAULT false`, `referral_code text UNIQUE`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, `deleted_at timestamptz`.
2. WHEN a new row is inserted into `auth.users`, THE Database SHALL automatically insert a corresponding row into `profiles` via a PostgreSQL trigger.
3. THE Database SHALL enable RLS on the `profiles` table.
4. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT and UPDATE only the `profiles` row where `id = auth.uid()`.
5. THE Database SHALL allow service-role callers to SELECT, INSERT, UPDATE, and DELETE any row in `profiles`.

---

### Requirement 3 — Brand Profiles Table

**User Story:** As a user, I want to store brand identity settings so that AI generation prompts can be automatically enriched with my brand voice and tone.

#### Acceptance Criteria

1. THE Database SHALL contain a `brand_profiles` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `team_id uuid REFERENCES teams(id) ON DELETE CASCADE`, `brand_name text NOT NULL`, `logo_url text`, `voice_guidelines text`, `tone_settings jsonb`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, `deleted_at timestamptz`.
2. THE Database SHALL enable RLS on the `brand_profiles` table.
3. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT, INSERT, UPDATE, and DELETE only `brand_profiles` rows where `user_id = auth.uid()` or where `team_id` matches a team the user belongs to.

---

### Requirement 4 — Teams and Membership Tables

**User Story:** As a team owner, I want team workspaces with role-based membership so that collaborators can access shared resources with appropriate permissions.

#### Acceptance Criteria

1. THE Database SHALL contain a `teams` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `name text NOT NULL`, `slug text UNIQUE NOT NULL`, `owner_id uuid NOT NULL REFERENCES profiles(id)`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, `deleted_at timestamptz`.
2. THE Database SHALL contain a `team_members` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `role text NOT NULL CHECK (role IN ('owner','admin','editor','viewer'))`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, with a UNIQUE constraint on `(team_id, user_id)`.
3. THE Database SHALL contain a `team_invitations` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `invited_by uuid NOT NULL REFERENCES profiles(id)`, `email text NOT NULL`, `role text NOT NULL CHECK (role IN ('admin','editor','viewer'))`, `token text UNIQUE NOT NULL`, `expires_at timestamptz NOT NULL`, `accepted_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`.
4. THE Database SHALL contain a `team_activity_log` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `actor_id uuid NOT NULL REFERENCES profiles(id)`, `action text NOT NULL`, `resource_type text`, `resource_id uuid`, `metadata jsonb`, `created_at timestamptz NOT NULL DEFAULT now()`.
5. THE Database SHALL enable RLS on `teams`, `team_members`, `team_invitations`, and `team_activity_log`.
6. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `teams` rows only where the user has a corresponding row in `team_members`.
7. WHILE a user is authenticated, THE Database SHALL allow that user to INSERT, UPDATE, and DELETE `team_members` rows only where the user's role in that team is `owner` or `admin`.
8. WHEN a `team_invitations` row has `expires_at` in the past and `accepted_at` IS NULL, THE Database SHALL treat the invitation as expired and exclude it from non-service-role SELECT results via RLS policy.

---

### Requirement 5 — Content Jobs Table

**User Story:** As a content creator, I want AI generation tasks tracked in the database so that the frontend can subscribe to real-time status updates without polling.

#### Acceptance Criteria

1. THE Database SHALL contain a `content_jobs` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES profiles(id)`, `content_type text NOT NULL CHECK (content_type IN ('text','image','video_script','audio'))`, `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled'))`, `prompt text NOT NULL`, `result_url text`, `error_message text`, `credits_reserved integer NOT NULL DEFAULT 0`, `credits_charged integer`, `metadata jsonb`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, `deleted_at timestamptz`.
2. THE Database SHALL enable RLS on `content_jobs`.
3. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `content_jobs` rows only where `team_id` matches a team the user belongs to.
4. WHILE a user is authenticated, THE Database SHALL allow that user to INSERT `content_jobs` rows only where `team_id` matches a team the user belongs to with role `editor`, `admin`, or `owner`.

---

### Requirement 6 — Scheduled Posts Table

**User Story:** As a social media manager, I want scheduled posts stored in the database so that the Calendar view can display and reschedule them via drag-and-drop.

#### Acceptance Criteria

1. THE Database SHALL contain a `scheduled_posts` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES profiles(id)`, `social_connection_id uuid REFERENCES social_connections(id)`, `content_job_id uuid REFERENCES content_jobs(id)`, `platform text NOT NULL`, `content text`, `media_urls jsonb`, `scheduled_at timestamptz NOT NULL`, `published_at timestamptz`, `status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','failed'))`, `error_message text`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, `deleted_at timestamptz`.
2. THE Database SHALL enable RLS on `scheduled_posts`.
3. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `scheduled_posts` rows only where `team_id` matches a team the user belongs to.
4. WHILE a user is authenticated, THE Database SHALL allow that user to INSERT and UPDATE `scheduled_posts` rows only where `team_id` matches a team the user belongs to with role `editor`, `admin`, or `owner`.

---

### Requirement 7 — Social Connections Table

**User Story:** As a user, I want OAuth tokens for connected social platforms stored encrypted so that the platform can publish on my behalf securely.

#### Acceptance Criteria

1. THE Database SHALL contain a `social_connections` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES profiles(id)`, `platform text NOT NULL`, `platform_account_id text NOT NULL`, `platform_username text`, `vault_secret_id uuid`, `scopes text[]`, `connected_at timestamptz NOT NULL DEFAULT now()`, `disconnected_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, with a UNIQUE constraint on `(team_id, platform, platform_account_id)`.
2. THE Database SHALL store OAuth access and refresh tokens exclusively via Supabase Vault, referencing the vault secret by `vault_secret_id` rather than storing raw token strings in the table.
3. THE Database SHALL enable RLS on `social_connections`.
4. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `social_connections` rows only where `team_id` matches a team the user belongs to.
5. WHILE a user is authenticated, THE Database SHALL allow that user to INSERT and DELETE `social_connections` rows only where `team_id` matches a team the user belongs to with role `admin` or `owner`.

---

### Requirement 8 — Webhook Events Table

**User Story:** As a platform engineer, I want incoming platform webhook payloads stored in the database so that they can be processed asynchronously without data loss.

#### Acceptance Criteria

1. THE Database SHALL contain a `webhook_events` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `source text NOT NULL`, `event_type text NOT NULL`, `payload jsonb NOT NULL`, `processed_at timestamptz`, `error_message text`, `created_at timestamptz NOT NULL DEFAULT now()`.
2. THE Database SHALL enable RLS on `webhook_events`.
3. THE Database SHALL restrict SELECT, INSERT, UPDATE, and DELETE on `webhook_events` to service-role callers only via RLS policy.

---

### Requirement 9 — Pipeline Executions Table

**User Story:** As a growth hacker, I want pipeline execution logs stored in the database so that the Workflow Dashboard can display real stats without hardcoded values.

#### Acceptance Criteria

1. THE Database SHALL contain a `pipeline_executions` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `pipeline_id text NOT NULL`, `pipeline_name text`, `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed'))`, `started_at timestamptz`, `completed_at timestamptz`, `duration_ms integer`, `error_message text`, `metadata jsonb`, `created_at timestamptz NOT NULL DEFAULT now()`.
2. THE Database SHALL enable RLS on `pipeline_executions`.
3. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `pipeline_executions` rows only where `team_id` matches a team the user belongs to.

---

### Requirement 10 — Media Items Table

**User Story:** As a content creator, I want all generated and uploaded media indexed in the database so that the Media Library can filter and attach assets to posts.

#### Acceptance Criteria

1. THE Database SHALL contain a `media_items` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES profiles(id)`, `content_job_id uuid REFERENCES content_jobs(id)`, `storage_path text NOT NULL`, `public_url text`, `file_name text NOT NULL`, `file_type text NOT NULL`, `file_size_bytes bigint NOT NULL`, `tags text[]`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, `deleted_at timestamptz`.
2. THE Database SHALL enable RLS on `media_items`.
3. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `media_items` rows only where `team_id` matches a team the user belongs to.
4. WHILE a user is authenticated, THE Database SHALL allow that user to INSERT and DELETE `media_items` rows only where `team_id` matches a team the user belongs to with role `editor`, `admin`, or `owner`.

---

### Requirement 11 — Wallets and Credit Transactions Tables

**User Story:** As a user, I want a credit wallet with a full transaction history so that I can track my AI generation spend in real time.

#### Acceptance Criteria

1. THE Database SHALL contain a `wallets` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid UNIQUE REFERENCES teams(id) ON DELETE CASCADE`, `user_id uuid UNIQUE REFERENCES profiles(id) ON DELETE CASCADE`, `balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0)`, `reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0)`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
2. THE Database SHALL contain a `credit_transactions` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `wallet_id uuid NOT NULL REFERENCES wallets(id)`, `type text NOT NULL CHECK (type IN ('purchase','deduction','refund','bonus'))`, `amount integer NOT NULL`, `description text`, `reference_id uuid`, `created_at timestamptz NOT NULL DEFAULT now()`.
3. THE Database SHALL provide a `reserve_credits(wallet_id uuid, amount integer)` PostgreSQL function that atomically increments `wallets.reserved` by `amount` and decrements `wallets.balance` by `amount` within a single transaction, returning an error if `balance - amount < 0`.
4. THE Database SHALL provide a `deduct_credits(wallet_id uuid, amount integer, description text, reference_id uuid)` PostgreSQL function that atomically decrements `wallets.reserved` by `amount`, inserts a `credit_transactions` row of type `deduction`, and returns the updated balance.
5. THE Database SHALL provide a `release_credits(wallet_id uuid, amount integer)` PostgreSQL function that atomically decrements `wallets.reserved` by `amount` and increments `wallets.balance` by `amount`, used when a job is cancelled or fails.
6. THE Database SHALL enable RLS on `wallets` and `credit_transactions`.
7. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT the `wallets` row where `user_id = auth.uid()` or where `team_id` matches a team the user belongs to.
8. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `credit_transactions` rows only for wallets the user is permitted to view.

---

### Requirement 12 — Pricing Config Table

**User Story:** As a platform admin, I want credit costs per content type stored in the database so that generation cost estimates are always consistent between the frontend and backend.

#### Acceptance Criteria

1. THE Database SHALL contain a `pricing_config` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `content_type text UNIQUE NOT NULL`, `credits_per_unit integer NOT NULL CHECK (credits_per_unit > 0)`, `description text`, `updated_at timestamptz NOT NULL DEFAULT now()`.
2. THE Database SHALL seed `pricing_config` with default rows for content types `text`, `image`, `video_script`, and `audio` in the initial migration.
3. THE Database SHALL enable RLS on `pricing_config`.
4. THE Database SHALL allow all authenticated users to SELECT any row in `pricing_config`.
5. THE Database SHALL restrict INSERT, UPDATE, and DELETE on `pricing_config` to service-role callers only.

---

### Requirement 13 — Subscriptions Table

**User Story:** As a billing engineer, I want subscription state stored in the database so that Stripe and Razorpay webhook handlers can update plan entitlements atomically.

#### Acceptance Criteria

1. THE Database SHALL contain a `subscriptions` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid REFERENCES teams(id) ON DELETE CASCADE`, `user_id uuid REFERENCES profiles(id) ON DELETE CASCADE`, `provider text NOT NULL CHECK (provider IN ('stripe','razorpay'))`, `provider_subscription_id text UNIQUE NOT NULL`, `plan text NOT NULL CHECK (plan IN ('free','starter','pro','agency'))`, `status text NOT NULL CHECK (status IN ('active','past_due','cancelled','trialing'))`, `current_period_start timestamptz`, `current_period_end timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
2. THE Database SHALL enable RLS on `subscriptions`.
3. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `subscriptions` rows where `user_id = auth.uid()` or where `team_id` matches a team the user belongs to.
4. THE Database SHALL restrict INSERT, UPDATE, and DELETE on `subscriptions` to service-role callers only.

---

### Requirement 14 — Notifications Table

**User Story:** As a user, I want notifications stored in the database so that the frontend can subscribe to real-time alerts via Supabase Realtime.

#### Acceptance Criteria

1. THE Database SHALL contain a `notifications` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `team_id uuid REFERENCES teams(id) ON DELETE CASCADE`, `type text NOT NULL`, `title text NOT NULL`, `body text`, `read_at timestamptz`, `metadata jsonb`, `created_at timestamptz NOT NULL DEFAULT now()`.
2. THE Database SHALL enable RLS on `notifications`.
3. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT and UPDATE (for marking as read) only `notifications` rows where `user_id = auth.uid()`.

---

### Requirement 15 — Analytics Events Table

**User Story:** As a product analyst, I want key user actions tracked in the database so that the Analytics dashboard can display real engagement data without hardcoded values.

#### Acceptance Criteria

1. THE Database SHALL contain an `analytics_events` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `user_id uuid REFERENCES profiles(id)`, `event_name text NOT NULL`, `properties jsonb`, `created_at timestamptz NOT NULL DEFAULT now()`.
2. THE Database SHALL enable RLS on `analytics_events`.
3. WHILE a user is authenticated, THE Database SHALL allow that user to INSERT `analytics_events` rows where `team_id` matches a team the user belongs to.
4. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `analytics_events` rows only where `team_id` matches a team the user belongs to.

---

### Requirement 16 — Referral and Affiliate Tables

**User Story:** As an affiliate program manager, I want referral clicks, conversions, and earnings tracked in the database so that payouts can be calculated accurately.

#### Acceptance Criteria

1. THE Database SHALL contain a `referral_events` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `referrer_id uuid NOT NULL REFERENCES profiles(id)`, `referred_email text`, `referred_user_id uuid REFERENCES profiles(id)`, `event_type text NOT NULL CHECK (event_type IN ('click','signup','conversion'))`, `attributed_at timestamptz NOT NULL DEFAULT now()`, `created_at timestamptz NOT NULL DEFAULT now()`.
2. THE Database SHALL contain an `affiliate_earnings` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `referral_event_id uuid REFERENCES referral_events(id)`, `amount_credits integer NOT NULL DEFAULT 0`, `amount_currency numeric(10,2) NOT NULL DEFAULT 0`, `currency text NOT NULL DEFAULT 'USD'`, `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled'))`, `paid_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`.
3. THE Database SHALL enable RLS on `referral_events` and `affiliate_earnings`.
4. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `referral_events` rows where `referrer_id = auth.uid()`.
5. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT `affiliate_earnings` rows where `user_id = auth.uid()`.

---

### Requirement 17 — Analytics Overview and Storage Usage Views

**User Story:** As a dashboard engineer, I want pre-built PostgreSQL views so that the Dashboard and Analytics pages can query aggregated data via PostgREST without complex client-side joins.

#### Acceptance Criteria

1. THE Database SHALL contain an `analytics_overview` view that aggregates, per `team_id`: total `content_jobs` count, count by `content_type`, count of `scheduled_posts` by `status`, total credits consumed (sum of `credit_transactions.amount` where `type = 'deduction'`), and count of `pipeline_executions` by `status`.
2. THE Database SHALL contain a `storage_usage` view that aggregates, per `team_id`: total `file_size_bytes` summed from `media_items` where `deleted_at IS NULL`, and count of non-deleted `media_items` rows.
3. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT rows from `analytics_overview` only for `team_id` values matching teams the user belongs to.
4. WHILE a user is authenticated, THE Database SHALL allow that user to SELECT rows from `storage_usage` only for `team_id` values matching teams the user belongs to.

---

### Requirement 18 — Row Level Security Completeness

**User Story:** As a security engineer, I want RLS enabled and enforced on every table so that no user can access another team's or user's data through PostgREST.

#### Acceptance Criteria

1. THE Database SHALL have `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY` applied to every table defined in the schema.
2. THE Database SHALL have `ALTER TABLE <table> FORCE ROW LEVEL SECURITY` applied to every table so that table owners are also subject to RLS policies.
3. IF a query is made by an authenticated user against a team-scoped table without a matching `team_members` row, THEN THE Database SHALL return zero rows rather than an error.
4. THE Database SHALL define a helper function `is_team_member(team_id uuid)` that returns `true` when `auth.uid()` has a row in `team_members` for the given `team_id`, for use in RLS policy expressions.
5. THE Database SHALL define a helper function `team_role(team_id uuid)` that returns the `role` text value from `team_members` for `auth.uid()` and the given `team_id`, for use in RLS policy expressions.

---

### Requirement 19 — CI Migration Testing

**User Story:** As a DevOps engineer, I want migrations validated against a clean PostgreSQL instance in CI so that schema regressions are caught before merging.

#### Acceptance Criteria

1. THE CI Pipeline SHALL apply all migrations in order against a fresh PostgreSQL 15 Docker container on every pull request.
2. WHEN all migrations complete without error, THE CI Pipeline SHALL report a passing status check.
3. IF any migration fails, THEN THE CI Pipeline SHALL report a failing status check and output the error message from PostgreSQL.
4. THE CI Pipeline SHALL run migration tests in a dedicated job that does not share state with the frontend lint or build jobs.

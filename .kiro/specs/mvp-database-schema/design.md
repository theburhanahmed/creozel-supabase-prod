# Design Document — MVP Database Schema

## Overview

The MVP database schema for Creozel is delivered as a set of versioned PostgreSQL migration files applied to a self-hosted Supabase instance (PostgreSQL 15+). The schema covers all core domain tables, helper functions, database-level functions for credit management, two aggregation views, and Row Level Security (RLS) policies on every table. The design follows a strict layered approach: extensions first, then helper functions, then tables in dependency order, then RLS policies, then views, then seed data.

All SQL is written for PostgreSQL 15+ and is compatible with Supabase's GoTrue (`auth.users`) and PostgREST conventions.

---

## Architecture

### Migration File Layout

```
supabase/
└── migrations/
    ├── 20240101000000_extensions.sql
    ├── 20240101000100_helper_functions.sql
    ├── 20240101000200_profiles.sql
    ├── 20240101000300_teams.sql
    ├── 20240101000400_brand_profiles.sql
    ├── 20240101000500_social_connections.sql
    ├── 20240101000600_content_jobs.sql
    ├── 20240101000700_scheduled_posts.sql
    ├── 20240101000800_webhook_events.sql
    ├── 20240101000900_pipeline_executions.sql
    ├── 20240101001000_media_items.sql
    ├── 20240101001100_wallets_and_credits.sql
    ├── 20240101001200_pricing_config.sql
    ├── 20240101001300_subscriptions.sql
    ├── 20240101001400_notifications.sql
    ├── 20240101001500_analytics_events.sql
    ├── 20240101001600_referral_affiliate.sql
    ├── 20240101001700_views.sql
    └── 20240101001800_rls_completeness.sql
```

Migrations are applied in lexicographic (timestamp) order. Each file is idempotent where possible using `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, and `DO $$ ... $$` guards.

### Dependency Graph

```
extensions
    └── helper_functions (uses auth schema)
        └── profiles (references auth.users)
            └── teams (references profiles)
                ├── brand_profiles (references profiles, teams)
                ├── social_connections (references profiles, teams)
                ├── content_jobs (references profiles, teams)
                │   └── scheduled_posts (references profiles, teams, social_connections, content_jobs)
                ├── webhook_events (standalone)
                ├── pipeline_executions (references teams)
                ├── media_items (references profiles, teams, content_jobs)
                ├── wallets_and_credits (references profiles, teams)
                ├── pricing_config (standalone)
                ├── subscriptions (references profiles, teams)
                ├── notifications (references profiles, teams)
                ├── analytics_events (references profiles, teams)
                └── referral_affiliate (references profiles)
                    └── views (references all tables above)
                        └── rls_completeness (ALTER TABLE ... FORCE ROW LEVEL SECURITY)
```

---

## Components

### 1. Extensions Migration

Enables `pgcrypto` (for `gen_random_uuid()`) and `uuid-ossp` (for `uuid_generate_v4()`) before any table is created.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 2. Helper Functions

Two reusable security-definer functions used in RLS policy expressions across all team-scoped tables:

```sql
-- Returns true if the current authenticated user is a member of the given team
CREATE OR REPLACE FUNCTION is_team_member(team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = $1
      AND team_members.user_id = auth.uid()
  );
$$;

-- Returns the role of the current authenticated user in the given team, or NULL
CREATE OR REPLACE FUNCTION team_role(team_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM team_members
  WHERE team_members.team_id = $1
    AND team_members.user_id = auth.uid()
  LIMIT 1;
$$;
```

Both functions are `SECURITY DEFINER` so they bypass RLS on `team_members` when evaluating policies on other tables, preventing infinite recursion.

### 3. Profiles Table

Links to `auth.users` via a 1:1 foreign key. A `AFTER INSERT ON auth.users` trigger automatically creates the corresponding `profiles` row.

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name             text,
  avatar_url               text,
  bio                      text,
  phone                    text,
  timezone                 text,
  notification_preferences jsonb,
  onboarding_completed     boolean NOT NULL DEFAULT false,
  referral_code            text UNIQUE,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**RLS Policies:**
- Authenticated users: SELECT and UPDATE where `id = auth.uid()`
- Service role: full access (bypasses RLS by default in Supabase)

### 4. Teams and Membership Tables

Three tables: `teams`, `team_members`, `team_invitations`, `team_activity_log`.

`team_members.role` is constrained to `('owner','admin','editor','viewer')`. A UNIQUE constraint on `(team_id, user_id)` prevents duplicate membership rows.

`team_invitations` uses a `token text UNIQUE NOT NULL` for secure email-based invite links. Expired invitations (`expires_at < now() AND accepted_at IS NULL`) are excluded from non-service-role SELECT via RLS.

**RLS Policies:**
- `teams`: SELECT where `is_team_member(id)`
- `team_members`: SELECT where `is_team_member(team_id)`; INSERT/UPDATE/DELETE where `team_role(team_id) IN ('owner','admin')`
- `team_invitations`: SELECT where `is_team_member(team_id)` AND not expired; INSERT/UPDATE where `team_role(team_id) IN ('owner','admin')`
- `team_activity_log`: SELECT where `is_team_member(team_id)`; INSERT via service role only

### 5. Brand Profiles Table

Scoped to either a user or a team (or both). RLS allows access when `user_id = auth.uid()` OR `is_team_member(team_id)`.

### 6. Social Connections Table

Stores OAuth-linked platform accounts. Raw tokens are **never** stored in this table — the `vault_secret_id uuid` column references a Supabase Vault secret. A UNIQUE constraint on `(team_id, platform, platform_account_id)` prevents duplicate connections.

**RLS Policies:**
- SELECT: `is_team_member(team_id)`
- INSERT/DELETE: `team_role(team_id) IN ('owner','admin')`

### 7. Content Jobs Table

The AI generation job queue. Status lifecycle: `pending → running → completed | failed | cancelled`. Credits are reserved at INSERT and charged/released by Edge Functions via the credit functions.

**RLS Policies:**
- SELECT: `is_team_member(team_id)`
- INSERT: `team_role(team_id) IN ('editor','admin','owner')`

### 8. Scheduled Posts Table

References `social_connections` and `content_jobs` (both nullable). Status lifecycle: `draft → scheduled → published | failed`.

**RLS Policies:**
- SELECT: `is_team_member(team_id)`
- INSERT/UPDATE: `team_role(team_id) IN ('editor','admin','owner')`

### 9. Webhook Events Table

Service-role only. No authenticated user policies. Used exclusively by Edge Functions processing incoming platform webhooks.

### 10. Pipeline Executions Table

Logs n8n workflow runs. Status: `pending | running | completed | failed`. `duration_ms` is computed by the Edge Function as `EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000`.

**RLS Policies:**
- SELECT: `is_team_member(team_id)`
- INSERT/UPDATE: service role only

### 11. Media Items Table

Indexes all assets in Supabase Storage. `storage_path` is the bucket-relative path; `public_url` is the signed or public URL. Soft-deleted via `deleted_at`.

**RLS Policies:**
- SELECT: `is_team_member(team_id)`
- INSERT/DELETE: `team_role(team_id) IN ('editor','admin','owner')`

### 12. Wallets and Credit Transactions

`wallets` has a CHECK constraint `balance >= 0` and `reserved >= 0`. The three credit management functions are `SECURITY DEFINER` to allow Edge Functions to call them via the anon key.

```sql
-- Reserve credits (deduct from available balance, add to reserved)
CREATE OR REPLACE FUNCTION reserve_credits(
  p_wallet_id uuid,
  p_amount    integer
) RETURNS wallets LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet wallets;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id FOR UPDATE;
  IF v_wallet.balance - p_amount < 0 THEN
    RAISE EXCEPTION 'Insufficient credits: balance=%, requested=%',
      v_wallet.balance, p_amount;
  END IF;
  UPDATE wallets
    SET balance   = balance   - p_amount,
        reserved  = reserved  + p_amount,
        updated_at = now()
  WHERE id = p_wallet_id
  RETURNING * INTO v_wallet;
  RETURN v_wallet;
END;
$$;

-- Deduct reserved credits and record transaction
CREATE OR REPLACE FUNCTION deduct_credits(
  p_wallet_id   uuid,
  p_amount      integer,
  p_description text,
  p_reference_id uuid DEFAULT NULL
) RETURNS wallets LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet wallets;
BEGIN
  UPDATE wallets
    SET reserved   = reserved   - p_amount,
        updated_at = now()
  WHERE id = p_wallet_id
  RETURNING * INTO v_wallet;

  INSERT INTO credit_transactions (wallet_id, type, amount, description, reference_id)
  VALUES (p_wallet_id, 'deduction', p_amount, p_description, p_reference_id);

  RETURN v_wallet;
END;
$$;

-- Release reserved credits back to available balance
CREATE OR REPLACE FUNCTION release_credits(
  p_wallet_id uuid,
  p_amount    integer
) RETURNS wallets LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet wallets;
BEGIN
  UPDATE wallets
    SET balance    = balance    + p_amount,
        reserved   = reserved   - p_amount,
        updated_at = now()
  WHERE id = p_wallet_id
  RETURNING * INTO v_wallet;
  RETURN v_wallet;
END;
$$;
```

**RLS Policies:**
- `wallets` SELECT: `user_id = auth.uid()` OR `is_team_member(team_id)`
- `credit_transactions` SELECT: wallet is accessible to the user (via a subquery join to `wallets`)

### 13. Pricing Config Table

Seeded with four default rows in the migration. Authenticated users can SELECT; only service role can INSERT/UPDATE/DELETE.

```sql
INSERT INTO pricing_config (content_type, credits_per_unit, description) VALUES
  ('text',         10, 'Text/copy generation via GPT-4'),
  ('image',        25, 'Image generation via DALL-E 3 or Stable Diffusion'),
  ('video_script', 15, 'Video script generation via GPT-4'),
  ('audio',        20, 'Audio/TTS generation via ElevenLabs')
ON CONFLICT (content_type) DO NOTHING;
```

### 14. Subscriptions Table

Managed exclusively by Stripe/Razorpay webhook Edge Functions (service role). Authenticated users can SELECT their own subscription.

### 15. Notifications Table

Supports Supabase Realtime subscriptions. Users can SELECT and UPDATE (mark as read) only their own notifications.

### 16. Analytics Events Table

Append-only event log. Users can INSERT events for their own teams and SELECT events for teams they belong to.

### 17. Referral and Affiliate Tables

`referral_events.event_type` is constrained to `('click','signup','conversion')`. Attribution window (30 days) is enforced at the application layer in Edge Functions, not in the database.

### 18. Analytics Overview and Storage Usage Views

```sql
CREATE OR REPLACE VIEW analytics_overview AS
SELECT
  cj.team_id,
  COUNT(cj.id)                                          AS total_content_jobs,
  COUNT(cj.id) FILTER (WHERE cj.content_type = 'text')         AS text_jobs,
  COUNT(cj.id) FILTER (WHERE cj.content_type = 'image')        AS image_jobs,
  COUNT(cj.id) FILTER (WHERE cj.content_type = 'video_script') AS video_script_jobs,
  COUNT(cj.id) FILTER (WHERE cj.content_type = 'audio')        AS audio_jobs,
  COUNT(sp.id)                                          AS total_scheduled_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'draft')      AS draft_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'scheduled')  AS scheduled_posts_count,
  COUNT(sp.id) FILTER (WHERE sp.status = 'published')  AS published_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'failed')     AS failed_posts,
  COALESCE(SUM(ct.amount) FILTER (WHERE ct.type = 'deduction'), 0) AS total_credits_consumed,
  COUNT(pe.id)                                          AS total_pipeline_executions,
  COUNT(pe.id) FILTER (WHERE pe.status = 'completed')  AS completed_pipelines,
  COUNT(pe.id) FILTER (WHERE pe.status = 'failed')     AS failed_pipelines
FROM teams t
LEFT JOIN content_jobs cj       ON cj.team_id = t.id
LEFT JOIN scheduled_posts sp    ON sp.team_id = t.id
LEFT JOIN wallets w             ON w.team_id  = t.id
LEFT JOIN credit_transactions ct ON ct.wallet_id = w.id
LEFT JOIN pipeline_executions pe ON pe.team_id = t.id
GROUP BY cj.team_id;

CREATE OR REPLACE VIEW storage_usage AS
SELECT
  team_id,
  COALESCE(SUM(file_size_bytes), 0) AS total_bytes,
  COUNT(*)                          AS total_files
FROM media_items
WHERE deleted_at IS NULL
GROUP BY team_id;
```

Views inherit RLS from their underlying tables when queried via PostgREST. An additional `SECURITY INVOKER` view policy ensures users only see rows for teams they belong to.

---

## Data Models

### Entity Relationship Summary

```
auth.users (Supabase managed)
    │ 1:1 trigger
    ▼
profiles ──────────────────────────────────────────────────────┐
    │ 1:N                                                       │
    ▼                                                           │
teams ◄──── team_members (user_id FK → profiles)               │
    │           │                                               │
    │           └── team_invitations                            │
    │           └── team_activity_log                           │
    │                                                           │
    ├──► brand_profiles (user_id FK → profiles)                 │
    ├──► social_connections (user_id FK → profiles)             │
    ├──► content_jobs (user_id FK → profiles)                   │
    │       └──► scheduled_posts (social_connection_id FK)      │
    ├──► pipeline_executions                                     │
    ├──► media_items (user_id FK → profiles)                    │
    ├──► wallets ──► credit_transactions                        │
    ├──► subscriptions                                          │
    ├──► notifications (user_id FK → profiles)                  │
    ├──► analytics_events (user_id FK → profiles)               │
    └──► webhook_events (service-role only)                     │
                                                                │
profiles ──► referral_events ──► affiliate_earnings ───────────┘
```

### Key Column Conventions

| Convention | Rule |
|---|---|
| Primary keys | `uuid DEFAULT gen_random_uuid()` on all tables except `profiles` (which uses `auth.users.id`) |
| Timestamps | All `timestamptz NOT NULL DEFAULT now()` |
| Soft deletes | `deleted_at timestamptz` on tables where data must be recoverable |
| Team scoping | `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE` on all team-scoped tables |
| Status enums | `text NOT NULL CHECK (status IN (...))` — no PostgreSQL ENUM types (easier to extend) |
| JSON fields | `jsonb` for structured metadata, preferences, and payload storage |

---

## Error Handling

### Migration Errors

- Each migration file wraps DDL in a transaction where possible. If a statement fails, the transaction rolls back and the migration runner (Supabase CLI or `psql`) reports the filename and error.
- `CREATE TABLE IF NOT EXISTS` and `ON CONFLICT DO NOTHING` prevent duplicate-creation errors on re-runs.
- Extension creation uses `CREATE EXTENSION IF NOT EXISTS` to be idempotent.

### Credit Function Errors

- `reserve_credits` raises a PostgreSQL exception (`RAISE EXCEPTION`) when `balance - amount < 0`. The calling Edge Function catches this and returns a 402 response to the frontend.
- `deduct_credits` and `release_credits` assume the caller has already validated the reserved amount. If `reserved - amount < 0`, the `CHECK (reserved >= 0)` constraint on `wallets` will raise a constraint violation.

### RLS Policy Errors

- When an authenticated user queries a team-scoped table without membership, PostgREST returns an empty array (`[]`) with HTTP 200 — not a 403. This is the standard Supabase RLS behavior and is intentional.
- Service-role callers bypass RLS entirely. Edge Functions use the service role key for all write operations that cross team boundaries (e.g., webhook processing, billing updates).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Profile auto-creation on user signup

*For any* valid user record inserted into `auth.users`, a corresponding row in `profiles` with the same `id` should exist immediately after the insert completes.

**Validates: Requirements 2.2**

---

### Property 2: Profile RLS isolation

*For any* two distinct authenticated users A and B, user A's SELECT query on `profiles` should return zero rows where `id = B.id`.

**Validates: Requirements 2.4**

---

### Property 3: Brand profile RLS isolation

*For any* authenticated user and any `brand_profiles` row where `user_id ≠ auth.uid()` and `team_id` does not match any team the user belongs to, a SELECT query should return zero rows for that brand profile.

**Validates: Requirements 3.3**

---

### Property 4: Team membership gates team visibility

*For any* team and any authenticated user who has no row in `team_members` for that team, a SELECT query on `teams` should return zero rows for that team.

**Validates: Requirements 4.6**

---

### Property 5: Role-based team_members write access

*For any* team and any authenticated user whose `team_members.role` is `viewer` or `editor`, an INSERT, UPDATE, or DELETE on `team_members` for that team should be rejected.

**Validates: Requirements 4.7**

---

### Property 6: Expired invitations are excluded

*For any* `team_invitations` row where `expires_at < now()` and `accepted_at IS NULL`, a SELECT query by a non-service-role authenticated user should return zero rows for that invitation.

**Validates: Requirements 4.8**

---

### Property 7: Content job RLS isolation and role-based insert

*For any* authenticated user who is not a member of a team, SELECT on `content_jobs` for that team returns zero rows. *For any* authenticated user with role `viewer` in a team, INSERT on `content_jobs` for that team is rejected.

**Validates: Requirements 5.3, 5.4**

---

### Property 8: Scheduled post RLS isolation and role-based write

*For any* authenticated user who is not a member of a team, SELECT on `scheduled_posts` for that team returns zero rows. *For any* authenticated user with role `viewer` in a team, INSERT and UPDATE on `scheduled_posts` for that team are rejected.

**Validates: Requirements 6.3, 6.4**

---

### Property 9: Social connection RLS and admin-only write

*For any* authenticated user who is not a member of a team, SELECT on `social_connections` for that team returns zero rows. *For any* authenticated user with role `editor` or `viewer` in a team, INSERT and DELETE on `social_connections` for that team are rejected.

**Validates: Requirements 7.4, 7.5**

---

### Property 10: reserve_credits atomicity and balance invariant

*For any* wallet with balance B and any reserve amount A where A ≤ B, after calling `reserve_credits(wallet_id, A)`: the wallet's `balance` equals B − A and `reserved` equals the prior reserved value plus A. *For any* reserve amount A where A > B, `reserve_credits` raises an exception and the wallet row is unchanged.

**Validates: Requirements 11.3**

---

### Property 11: release_credits is the inverse of reserve_credits

*For any* wallet and any amount A ≤ wallet.balance, calling `reserve_credits(wallet_id, A)` followed immediately by `release_credits(wallet_id, A)` should restore the wallet's `balance` and `reserved` to their original values.

**Validates: Requirements 11.5**

---

### Property 12: deduct_credits records a transaction

*For any* wallet and any deduction amount A ≤ wallet.reserved, after calling `deduct_credits(wallet_id, A, description, reference_id)`: a `credit_transactions` row of type `deduction` with `amount = A` exists, and `wallet.reserved` has decreased by A.

**Validates: Requirements 11.4**

---

### Property 13: analytics_overview aggregation correctness

*For any* team with a known set of `content_jobs` rows, the `analytics_overview` view's `total_content_jobs` count and per-`content_type` counts should equal the actual counts of non-null rows in `content_jobs` for that team.

**Validates: Requirements 17.1**

---

### Property 14: storage_usage excludes soft-deleted items

*For any* team with a known set of `media_items` rows (some with `deleted_at` set), the `storage_usage` view's `total_bytes` should equal the sum of `file_size_bytes` only for rows where `deleted_at IS NULL`.

**Validates: Requirements 17.2**

---

### Property 15: Pipeline execution RLS isolation

*For any* authenticated user who is not a member of a team, SELECT on `pipeline_executions` for that team returns zero rows.

**Validates: Requirements 9.3**

---

### Property 16: Media items RLS isolation and role-based write

*For any* authenticated user who is not a member of a team, SELECT on `media_items` for that team returns zero rows. *For any* authenticated user with role `viewer` in a team, INSERT and DELETE on `media_items` for that team are rejected.

**Validates: Requirements 10.3, 10.4**

---

### Property 17: Notification RLS user isolation

*For any* two distinct authenticated users A and B, user A's SELECT query on `notifications` should return zero rows where `user_id = B.id`.

**Validates: Requirements 14.3**

---

### Property 18: Analytics events team isolation

*For any* authenticated user who is not a member of a team, SELECT on `analytics_events` for that team returns zero rows.

**Validates: Requirements 15.4**

---

### Property 19: Referral and affiliate RLS user isolation

*For any* authenticated user A, SELECT on `referral_events` returns only rows where `referrer_id = A.id`. SELECT on `affiliate_earnings` returns only rows where `user_id = A.id`.

**Validates: Requirements 16.4, 16.5**

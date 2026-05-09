# Requirements: MVP Database Schema

## Overview
Establish the complete PostgreSQL database schema for Creozel's MVP using Supabase migrations. This is the foundational layer that all other features depend on — no frontend feature can be fully implemented until the underlying tables, views, RLS policies, and triggers exist.

## Requirements

### 1. User & Profile Tables
- **REQ-1.1**: A `profiles` table must exist, linked to `auth.users` via a foreign key on `id`, storing: `display_name`, `avatar_url`, `bio`, `phone`, `timezone`, `notification_preferences` (jsonb), `onboarding_completed` (bool, default false), `referral_code` (unique text), `credits` (int, default 0).
- **REQ-1.2**: A `brand_profiles` table must exist per user: `user_id`, `brand_name`, `logo_url`, `voice_guidelines` (text), `tone_settings` (jsonb).
- **REQ-1.3**: A trigger must automatically create a `profiles` row whenever a new `auth.users` row is inserted.
- **REQ-1.4**: Each user's `referral_code` must be auto-generated as a unique 8-character alphanumeric string on insert.

### 2. Team Tables
- **REQ-2.1**: A `teams` table must exist: `id`, `name`, `logo_url`, `owner_id` (references `auth.users`), `created_at`.
- **REQ-2.2**: A `team_members` table must exist: `team_id`, `user_id`, `role` (enum: `owner`, `admin`, `editor`, `viewer`), `joined_at`.
- **REQ-2.3**: A `team_invitations` table must exist: `team_id`, `email`, `role`, `token` (unique), `invited_by`, `expires_at` (default now() + 7 days), `accepted_at`.

### 3. Content & Jobs Tables
- **REQ-3.1**: A `content_jobs` table must exist: `id`, `user_id`, `team_id`, `type` (enum: `text`, `image`, `video`, `audio`), `status` (enum: `pending`, `running`, `completed`, `failed`), `prompt`, `result_url`, `credits_reserved` (int), `credits_used` (int), `error_message`, `metadata` (jsonb), `created_at`, `updated_at`.
- **REQ-3.2**: A `scheduled_posts` table must exist: `id`, `user_id`, `team_id`, `content` (text), `platform` (enum: `instagram`, `youtube`, `twitter`, `facebook`, `linkedin`, `tiktok`), `scheduled_at` (timestamptz), `status` (enum: `draft`, `scheduled`, `published`, `failed`), `media_urls` (text[]), `error_message`, `social_connection_id`, `created_at`, `updated_at`.

### 4. Social & Webhook Tables
- **REQ-4.1**: A `social_connections` table must exist: `id`, `user_id`, `team_id`, `platform`, `account_name`, `account_id`, `access_token_encrypted` (text), `refresh_token_encrypted` (text), `token_expires_at`, `is_active` (bool, default true), `created_at`.
- **REQ-4.2**: A `webhook_events` table must exist: `id`, `platform`, `event_type`, `payload` (jsonb), `processed_at`, `created_at`.

### 5. Pipeline & Automation Tables
- **REQ-5.1**: A `pipeline_executions` table must exist: `id`, `team_id`, `pipeline_name`, `status` (enum: `pending`, `running`, `completed`, `failed`), `started_at`, `completed_at`, `error_message`, `step_failed` (text), `metadata` (jsonb).

### 6. Media Library Table
- **REQ-6.1**: A `media_items` table must exist: `id`, `user_id`, `team_id`, `name`, `type` (enum: `image`, `video`, `audio`, `document`), `size_bytes` (bigint), `storage_path`, `public_url`, `thumbnail_url`, `tags` (text[]), `metadata` (jsonb), `created_at`.

### 7. Credits & Billing Tables
- **REQ-7.1**: A `wallets` table must exist: `id`, `user_id`, `team_id` (nullable), `balance` (int, default 0), `reserved` (int, default 0), `updated_at`.
- **REQ-7.2**: A trigger must automatically create a `wallets` row whenever a new `profiles` row is inserted.
- **REQ-7.3**: A `credit_transactions` table must exist: `id`, `wallet_id`, `type` (enum: `purchase`, `deduction`, `refund`, `bonus`), `amount` (int), `description`, `reference_id`, `metadata` (jsonb), `created_at`.
- **REQ-7.4**: A `pricing_config` table must exist: `id`, `content_type` (text, unique), `credits_cost` (int), `is_active` (bool, default true). Seeded with default values for text (5), image (10), video (20), audio (8).
- **REQ-7.5**: A `subscriptions` table must exist: `id`, `user_id`, `team_id`, `plan` (enum: `free`, `starter`, `pro`, `agency`), `status` (text), `stripe_subscription_id`, `razorpay_subscription_id`, `current_period_start`, `current_period_end`, `created_at`, `updated_at`.

### 8. Notifications & Analytics Tables
- **REQ-8.1**: A `notifications` table must exist: `id`, `user_id`, `type` (text), `title`, `body`, `is_read` (bool, default false), `metadata` (jsonb), `created_at`.
- **REQ-8.2**: An `analytics_events` table must exist: `id`, `user_id`, `team_id`, `event_type` (text), `properties` (jsonb), `created_at`.

### 9. Affiliate Tables
- **REQ-9.1**: A `referral_events` table must exist: `id`, `referrer_user_id`, `referred_email`, `clicked_at`, `converted_at`, `conversion_value` (int).
- **REQ-9.2**: An `affiliate_earnings` table must exist: `id`, `user_id`, `amount` (int), `status` (enum: `pending`, `paid`), `period_start`, `period_end`, `created_at`.

### 10. Views
- **REQ-10.1**: An `analytics_overview` view must exist per team, returning: `team_id`, `total_posts`, `published_posts`, `scheduled_posts`, `total_credits_used`, `active_pipelines`, `pipeline_success_rate`.

### 11. Row Level Security
- **REQ-11.1**: RLS must be enabled on all tables.
- **REQ-11.2**: Users may only read/write their own `profiles`, `brand_profiles`, `wallets`, `notifications`, `credit_transactions` rows.
- **REQ-11.3**: Team-scoped tables (`content_jobs`, `scheduled_posts`, `social_connections`, `pipeline_executions`, `media_items`, `analytics_events`) must be accessible only to members of the relevant team (via `team_members` lookup).
- **REQ-11.4**: `pricing_config` is publicly readable; only service role may write.
- **REQ-11.5**: `webhook_events` is service-role write only; no user-level access.

### 12. Correctness Properties
- **PROP-1**: For any `auth.users` insert, a corresponding `profiles` row must exist within the same transaction.
- **PROP-2**: For any `profiles` insert, a corresponding `wallets` row must exist within the same transaction.
- **PROP-3**: A user querying any team-scoped table must never see rows belonging to a team they are not a member of.
- **PROP-4**: `wallets.balance` must never go below 0 (enforced via CHECK constraint).
- **PROP-5**: `credit_transactions.amount` must be non-zero.

# Implementation Tasks — MVP Database Schema

## Task Dependency Graph

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → T18 → T19
```

---

- [ ] 1. Create extensions migration
  - Create `supabase/migrations/20240101000000_extensions.sql`
  - Enable `pgcrypto` and `uuid-ossp` extensions with `CREATE EXTENSION IF NOT EXISTS`
  - **Validates:** Requirement 1.4

- [ ] 2. Create helper functions migration
  - Create `supabase/migrations/20240101000100_helper_functions.sql`
  - Implement `is_team_member(team_id uuid)` as `SECURITY DEFINER` function
  - Implement `team_role(team_id uuid)` as `SECURITY DEFINER` function
  - **Validates:** Requirement 18.4, 18.5

- [ ] 3. Create profiles migration
  - Create `supabase/migrations/20240101000200_profiles.sql`
  - Define `profiles` table with all columns per Requirement 2.1
  - Add `handle_new_user()` trigger function and `on_auth_user_created` trigger
  - Enable RLS; add SELECT/UPDATE policy for `id = auth.uid()`
  - **Validates:** Requirements 2.1–2.5

- [ ] 4. Create teams and membership migration
  - Create `supabase/migrations/20240101000300_teams.sql`
  - Define `teams`, `team_members`, `team_invitations`, `team_activity_log` tables
  - Add UNIQUE constraint on `team_members(team_id, user_id)`
  - Enable RLS on all four tables with role-based and expiry-aware policies
  - **Validates:** Requirements 4.1–4.8

- [ ] 5. Create brand profiles migration
  - Create `supabase/migrations/20240101000400_brand_profiles.sql`
  - Define `brand_profiles` table with user/team dual-scope
  - Enable RLS with `user_id = auth.uid() OR is_team_member(team_id)` policy
  - **Validates:** Requirements 3.1–3.3

- [ ] 6. Create social connections migration
  - Create `supabase/migrations/20240101000500_social_connections.sql`
  - Define `social_connections` table with `vault_secret_id` (no raw token columns)
  - Add UNIQUE constraint on `(team_id, platform, platform_account_id)`
  - Enable RLS with admin/owner write restriction
  - **Validates:** Requirements 7.1–7.5

- [ ] 7. Create content jobs migration
  - Create `supabase/migrations/20240101000600_content_jobs.sql`
  - Define `content_jobs` table with status CHECK constraint and credit columns
  - Enable RLS: SELECT for team members, INSERT for editor/admin/owner
  - **Validates:** Requirements 5.1–5.4

- [ ] 8. Create scheduled posts migration
  - Create `supabase/migrations/20240101000700_scheduled_posts.sql`
  - Define `scheduled_posts` table with status lifecycle CHECK constraint
  - Enable RLS: SELECT for team members, INSERT/UPDATE for editor/admin/owner
  - **Validates:** Requirements 6.1–6.4

- [ ] 9. Create webhook events migration
  - Create `supabase/migrations/20240101000800_webhook_events.sql`
  - Define `webhook_events` table
  - Enable RLS with service-role-only policy (no authenticated user access)
  - **Validates:** Requirements 8.1–8.3

- [ ] 10. Create pipeline executions migration
  - Create `supabase/migrations/20240101000900_pipeline_executions.sql`
  - Define `pipeline_executions` table with duration_ms column
  - Enable RLS: SELECT for team members, INSERT/UPDATE service role only
  - **Validates:** Requirements 9.1–9.3

- [ ] 11. Create media items migration
  - Create `supabase/migrations/20240101001000_media_items.sql`
  - Define `media_items` table with `storage_path`, `file_size_bytes`, `tags`, soft delete
  - Enable RLS: SELECT for team members, INSERT/DELETE for editor/admin/owner
  - **Validates:** Requirements 10.1–10.4

- [ ] 12. Create wallets and credit transactions migration
  - Create `supabase/migrations/20240101001100_wallets_and_credits.sql`
  - Define `wallets` table with `CHECK (balance >= 0)` and `CHECK (reserved >= 0)`
  - Define `credit_transactions` table
  - Implement `reserve_credits`, `deduct_credits`, `release_credits` as `SECURITY DEFINER` functions
  - Enable RLS on both tables
  - **Validates:** Requirements 11.1–11.8

- [ ] 13. Create pricing config migration
  - Create `supabase/migrations/20240101001200_pricing_config.sql`
  - Define `pricing_config` table
  - Seed default rows for `text` (10), `image` (25), `video_script` (15), `audio` (20) with `ON CONFLICT DO NOTHING`
  - Enable RLS: SELECT for all authenticated, INSERT/UPDATE/DELETE service role only
  - **Validates:** Requirements 12.1–12.5

- [ ] 14. Create subscriptions migration
  - Create `supabase/migrations/20240101001300_subscriptions.sql`
  - Define `subscriptions` table with provider and plan CHECK constraints
  - Enable RLS: SELECT for owner, INSERT/UPDATE/DELETE service role only
  - **Validates:** Requirements 13.1–13.4

- [ ] 15. Create notifications migration
  - Create `supabase/migrations/20240101001400_notifications.sql`
  - Define `notifications` table
  - Enable RLS: SELECT and UPDATE for `user_id = auth.uid()` only
  - **Validates:** Requirements 14.1–14.3

- [ ] 16. Create analytics events migration
  - Create `supabase/migrations/20240101001500_analytics_events.sql`
  - Define `analytics_events` table
  - Enable RLS: INSERT and SELECT for team members
  - **Validates:** Requirements 15.1–15.4

- [ ] 17. Create referral and affiliate migration
  - Create `supabase/migrations/20240101001600_referral_affiliate.sql`
  - Define `referral_events` and `affiliate_earnings` tables
  - Enable RLS: referrer-scoped SELECT on `referral_events`, user-scoped SELECT on `affiliate_earnings`
  - **Validates:** Requirements 16.1–16.5

- [ ] 18. Create views migration
  - Create `supabase/migrations/20240101001700_views.sql`
  - Implement `analytics_overview` view with LEFT JOINs and FILTER aggregations
  - Implement `storage_usage` view filtering `deleted_at IS NULL`
  - **Validates:** Requirements 17.1–17.4

- [ ] 19. Create RLS completeness migration and CI job
  - Create `supabase/migrations/20240101001800_rls_completeness.sql`
  - Apply `ALTER TABLE <table> FORCE ROW LEVEL SECURITY` to all tables
  - Add CI job in `.github/workflows/ci.yml` that applies all migrations against a fresh PostgreSQL 15 Docker container
  - **Validates:** Requirements 18.1–18.3, 19.1–19.4

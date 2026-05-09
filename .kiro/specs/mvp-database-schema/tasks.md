# Tasks: MVP Database Schema

## Implementation Tasks

- [x] 1. Create supabase directory structure and config
  - [x] 1.1 Create `supabase/config.toml` with local project configuration
  - [x] 1.2 Create `supabase/migrations/` directory

- [x] 2. Write migration: enums
  - [x] 2.1 Create `supabase/migrations/20260501000001_enums.sql` with all PostgreSQL enum types

- [x] 3. Write migration: profiles and brand_profiles
  - [x] 3.1 Create `supabase/migrations/20260501000002_profiles.sql`
  - [x] 3.2 Include `profiles` table with all columns and CHECK constraints
  - [x] 3.3 Include `brand_profiles` table
  - [x] 3.4 Include `handle_new_user` trigger function and trigger

- [x] 4. Write migration: teams
  - [x] 4.1 Create `supabase/migrations/20260501000003_teams.sql`
  - [x] 4.2 Include `teams`, `team_members`, `team_invitations` tables
  - [x] 4.3 Include `is_team_member` and `team_member_role` helper functions

- [x] 5. Write migration: social connections (before content, due to FK)
  - [x] 5.1 Create `supabase/migrations/20260501000004_social.sql`
  - [x] 5.2 Include `social_connections` and `webhook_events` tables

- [x] 6. Write migration: content jobs and scheduled posts
  - [x] 6.1 Create `supabase/migrations/20260501000005_content.sql`
  - [x] 6.2 Include `content_jobs` table
  - [x] 6.3 Include `scheduled_posts` table with FK to `social_connections`

- [x] 7. Write migration: pipelines
  - [x] 7.1 Create `supabase/migrations/20260501000006_pipelines.sql`
  - [x] 7.2 Include `pipeline_executions` table

- [x] 8. Write migration: media library
  - [x] 8.1 Create `supabase/migrations/20260501000007_media.sql`
  - [x] 8.2 Include `media_items` table

- [x] 9. Write migration: credits and billing
  - [x] 9.1 Create `supabase/migrations/20260501000008_credits.sql`
  - [x] 9.2 Include `wallets` table with CHECK constraint (balance >= 0)
  - [x] 9.3 Include `handle_new_profile` trigger function and trigger
  - [x] 9.4 Include `credit_transactions` table with CHECK constraint (amount != 0)
  - [x] 9.5 Include `pricing_config` table
  - [x] 9.6 Include `subscriptions` table

- [x] 10. Write migration: notifications and analytics
  - [x] 10.1 Create `supabase/migrations/20260501000009_notifications_analytics.sql`
  - [x] 10.2 Include `notifications` table
  - [x] 10.3 Include `analytics_events` table

- [x] 11. Write migration: affiliate
  - [x] 11.1 Create `supabase/migrations/20260501000010_affiliate.sql`
  - [x] 11.2 Include `referral_events` and `affiliate_earnings` tables

- [x] 12. Write migration: analytics view
  - [x] 12.1 Create `supabase/migrations/20260501000011_views.sql`
  - [x] 12.2 Include `analytics_overview` view

- [x] 13. Write migration: RLS policies
  - [x] 13.1 Create `supabase/migrations/20260501000012_rls.sql`
  - [x] 13.2 Enable RLS on all tables
  - [x] 13.3 Add policies for user-scoped tables (profiles, brand_profiles, wallets, notifications)
  - [x] 13.4 Add policies for team-scoped tables using helper functions
  - [x] 13.5 Add policies for pricing_config (public read)
  - [x] 13.6 Add policies for webhook_events (service role only)

- [x] 14. Write migration: seed data
  - [x] 14.1 Create `supabase/migrations/20260501000013_seed.sql`
  - [x] 14.2 Insert default pricing_config rows for all content types

- [x] 15. Update TypeScript types to match schema
  - [x] 15.1 Update `frontend/src/types/index.ts` to align field names with actual DB columns (snake_case)
  - [x] 15.2 Add missing types: `BrandProfile`, `TeamInvitation`, `PipelineExecution`, `Subscription`, `Notification`, `AnalyticsEvent`

# Migration Rollback Guide

## Overview

Creozel uses **forward-only migrations** — each migration file in `supabase/migrations/` is applied once and never modified. This is the standard Supabase approach.

When a migration needs to be undone, the correct approach is to write a **compensating migration** — a new `.sql` file that reverses the effect of the previous one.

> ⚠️ **PostgreSQL enum additions (`ALTER TYPE ... ADD VALUE`) are irreversible.** You cannot remove an enum value once added. The only option is to create a new enum type and migrate the column.

---

## Rollback Strategy

### Option A — Compensating Migration (preferred)

1. Identify the migration to undo (e.g., `20260501000015_add_feature.sql`)
2. Create a new migration file with the next timestamp: `20260501000016_revert_add_feature.sql`
3. Write SQL that reverses the changes (DROP TABLE, ALTER TABLE DROP COLUMN, etc.)
4. Apply the new migration: `psql -h localhost -U postgres -d creozel -f supabase/migrations/20260501000016_revert_add_feature.sql`

### Option B — Database Restore (emergency only)

If a migration causes data loss and a compensating migration is not feasible:

1. Stop all application traffic
2. In the Supabase dashboard → **Database** → **Backups**
3. Select the backup taken before the bad migration
4. Click **Restore** and confirm
5. Re-apply only the migrations that should remain

---

## Migration Index

| File | Purpose | Rollback Approach |
|------|---------|-------------------|
| `20260501000001_enums.sql` | All PostgreSQL enum types | Enum values cannot be removed; create new enum if needed |
| `20260501000002_profiles.sql` | `profiles`, `brand_profiles` tables + auto-create trigger | `DROP TABLE brand_profiles; DROP TABLE profiles;` |
| `20260501000003_teams.sql` | `teams`, `team_members`, `team_invitations` + RLS helpers | `DROP TABLE team_invitations; DROP TABLE team_members; DROP TABLE teams;` |
| `20260501000004_social.sql` | `social_connections`, `webhook_events` | `DROP TABLE webhook_events; DROP TABLE social_connections;` |
| `20260501000005_content.sql` | `content_jobs`, `scheduled_posts` | `DROP TABLE scheduled_posts; DROP TABLE content_jobs;` |
| `20260501000006_pipelines.sql` | `pipeline_executions` | `DROP TABLE pipeline_executions;` |
| `20260501000007_media.sql` | `media_items` | `DROP TABLE media_items;` |
| `20260501000008_credits.sql` | `wallets`, `credit_transactions`, `pricing_config`, `subscriptions` | Drop in reverse dependency order |
| `20260501000009_notifications_analytics.sql` | `notifications`, `analytics_events` | `DROP TABLE analytics_events; DROP TABLE notifications;` |
| `20260501000010_affiliate.sql` | `referral_events`, `affiliate_earnings` | `DROP TABLE affiliate_earnings; DROP TABLE referral_events;` |
| `20260501000011_views.sql` | `analytics_overview` view | `DROP VIEW analytics_overview;` |
| `20260501000012_rls.sql` | RLS policies on all tables | `DROP POLICY "..." ON table_name;` for each policy |
| `20260501000013_seed.sql` | `pricing_config` seed data | `DELETE FROM pricing_config;` |
| `20260501000014_storage.sql` | Storage buckets (`generated-content`, `media`) | Remove via Supabase dashboard → Storage |

---

## Step-by-Step: Applying a Compensating Migration

```bash
# 1. Create the compensating migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_revert_<description>.sql

# 2. Write the reversal SQL in the file

# 3. Apply it to the local database
psql -h localhost -U postgres -d creozel -f supabase/migrations/<new_file>.sql

# 4. Verify the change
psql -h localhost -U postgres -d creozel -c "\dt public.*"

# 5. Commit and push — CI will validate the migration applies cleanly
git add supabase/migrations/<new_file>.sql
git commit -m "revert: <description>"
```

---

## Emergency Contacts

- Supabase self-hosted backup location: configured in `docker-compose.yml` under the `db` service
- To take a manual backup: `pg_dump -h localhost -U postgres creozel > backup_$(date +%Y%m%d_%H%M%S).sql`
- To restore from a dump: `psql -h localhost -U postgres creozel < backup_file.sql`

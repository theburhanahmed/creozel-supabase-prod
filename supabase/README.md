# Supabase Setup

## Local Development

The project uses a self-hosted Supabase instance running via Docker Compose.

### Start Supabase

```bash
docker-compose up -d
```

Supabase will be available at:
- **API / Kong gateway**: http://localhost:8000
- **Studio dashboard**: http://localhost:3000
- **PostgreSQL**: localhost:5432

### Apply Migrations

Install the Supabase CLI, then run:

```bash
supabase db push
```

Or apply migrations manually against the running PostgreSQL instance:

```bash
# Connect to the local DB
psql postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:5432/postgres

# Run each migration in order
\i supabase/migrations/20260501000001_enums.sql
\i supabase/migrations/20260501000002_profiles.sql
# ... etc
```

### Migration Order

Migrations must be applied in filename order (they are numbered):

1. `20260501000001_enums.sql` — PostgreSQL enum types
2. `20260501000002_profiles.sql` — User profiles + brand profiles + triggers
3. `20260501000003_teams.sql` — Teams, members, invitations, helper functions
4. `20260501000004_social.sql` — Social connections + webhook events
5. `20260501000005_content.sql` — Content jobs + scheduled posts
6. `20260501000006_pipelines.sql` — Pipeline executions
7. `20260501000007_media.sql` — Media library
8. `20260501000008_credits.sql` — Wallets, transactions, pricing, subscriptions
9. `20260501000009_notifications_analytics.sql` — Notifications + analytics events
10. `20260501000010_affiliate.sql` — Referral events + affiliate earnings
11. `20260501000011_views.sql` — analytics_overview view
12. `20260501000012_rls.sql` — Row Level Security policies
13. `20260501000013_seed.sql` — Default pricing config
14. `20260501000014_storage.sql` — Storage buckets + policies

### Edge Functions

Deploy Edge Functions with:

```bash
supabase functions deploy generate-content
```

Required environment variables for Edge Functions (set in Supabase dashboard or `.env`):
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `REPLICATE_API_TOKEN`

### Frontend Environment

Copy `frontend/.env.example` to `frontend/.env` and set:

```
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=<your ANON_KEY from root .env>
```

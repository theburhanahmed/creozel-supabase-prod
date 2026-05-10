# Requirements — mvp-dashboard

## Overview

Wire the Creozel dashboard to live Supabase data. All hardcoded `'—'` placeholders are replaced with real values fetched via `@supabase/supabase-js`. The feature covers four data domains: analytics overview stats, wallet credits balance, recent scheduled posts, and onboarding checklist state. A secondary scope covers the Analytics page's per-platform engagement trend charts with a selectable time range. No AI suggestions, no mock data, no `setTimeout` simulations.

---

## Requirements

### 1. Analytics Overview Stats

**REQ-1.1** The dashboard stat cards (Posts Published, Posts Scheduled, Active Pipelines) must display values read from the `analytics_overview` PostgreSQL view via PostgREST. No hardcoded fallback values other than `0` when the view returns `null`.

**REQ-1.2** When the authenticated user belongs to an active team, `getAnalyticsOverview` must filter the view by `team_id`. When no active team exists, it must filter with `team_id IS NULL` (personal scope).

**REQ-1.3** The Quick Stats sidebar panel must display `total_jobs`, `total_credits_used`, `total_pipeline_runs`, `pipeline_success_rate`, and `connected_accounts` from the same `analytics_overview` row.

**REQ-1.4** The `analytics_overview` view must exist in the database and expose at minimum the columns referenced in `AnalyticsOverview` (see `src/types/index.ts`). A migration file must create or replace this view.

**REQ-1.5** If `getAnalyticsOverview` returns `null` (view row not found or RLS blocks access), all stat values must render as `0` — never as `undefined`, `NaN`, or `'—'`.

---

### 2. Recent Scheduled Posts

**REQ-2.1** The Recent Posts panel must load the 5 most recent rows from `scheduled_posts` where `status IN ('scheduled', 'published')`, ordered by `scheduled_at DESC`, via `getRecentPosts`.

**REQ-2.2** Each post row must display: platform icon, truncated content (≤ 80 chars), status badge, and formatted `scheduled_at` date.

**REQ-2.3** When the `scheduled_posts` table is empty or returns no rows, the panel must show an empty-state prompt with a "Create Content" link — no skeleton, no error.

**REQ-2.4** Post status badge colours must follow the `STATUS_STYLES` map: `scheduled` → blue, `published` → green, `failed` → red, `draft` → grey.

---

### 3. Wallet / Credits Balance

**REQ-3.1** The "Credits Remaining" stat card must display `wallets.balance` for the authenticated user's personal wallet (`team_id IS NULL`), fetched via `getWalletBalance(user.id)`.

**REQ-3.2** If the wallet row does not exist, the card must display `0`.

**REQ-3.3** The wallet query must select only the personal wallet row; team wallets are out of scope for the dashboard stat card.

---

### 4. Onboarding Checklist

**REQ-4.1** The onboarding checklist must be shown when `onboarding.isComplete === false` AND `user.onboarding_completed === false`. It must be hidden otherwise.

**REQ-4.2** The checklist must derive its three step states from live COUNT queries against `social_connections`, `content_jobs`, and `scheduled_posts` — not from `profiles` flags.

**REQ-4.3** `getOnboardingStatus` must run all three COUNT queries in parallel via `Promise.all`.

**REQ-4.4** When all three steps are complete (`isComplete === true`) and `user.onboarding_completed` is still `false`, `markOnboardingComplete` must be called to PATCH `profiles.onboarding_completed = true`.

**REQ-4.5** When onboarding is complete, the checklist panel is replaced by the Quick Stats sidebar panel.

---

### 5. Analytics Page — Engagement Trends

**REQ-5.1** The Analytics page must provide a time-range selector with options: 7 days, 30 days, 90 days. The selected range must filter the data displayed in all charts.

**REQ-5.2** Engagement trend data must be read from the `analytics_events` table, grouped by day and event type, for the selected time range. No hardcoded chart data arrays.

**REQ-5.3** The Analytics page must render at minimum two Recharts charts: Post Status Breakdown (BarChart) and Pipeline Performance (BarChart). Both must use data derived from `analytics_overview` or `analytics_events` queries — not static arrays.

**REQ-5.4** A per-platform breakdown section must show, for each connected platform, the count of published posts within the selected time range, sourced from `scheduled_posts` filtered by `status = 'published'` and `platform`.

**REQ-5.5** If no analytics data exists for the selected range, an empty-state illustration must be shown instead of empty charts.

---

### 6. Error Handling & Code Quality

**REQ-6.1** All `catch` blocks in service files must use `catch (error: unknown)` with `reportError` from `src/utils/errorReporter.ts`. No `catch (error: any)` or bare `console.error`.

**REQ-6.2** All service functions must return a safe fallback (`null`, `[]`, or `0`) on error — never throw to the caller.

**REQ-6.3** The dashboard `loadDashboard` function must use a single `try/catch` wrapping `Promise.all` for all four parallel fetches, with a user-visible error banner and a Retry button on failure.

**REQ-6.4** Loading states must use skeleton placeholders (animated `bg-gray-200` divs) — no spinners replacing content areas.

**REQ-6.5** `npx tsc --noEmit` must exit 0 after all changes. No `any` types introduced.

---

### 7. Database Migration

**REQ-7.1** A SQL migration file must create the `analytics_overview` view if it does not already exist. The view must aggregate data from `scheduled_posts`, `content_jobs`, `pipeline_executions`, `social_connections`, and `wallets`.

**REQ-7.2** The migration must be idempotent (`CREATE OR REPLACE VIEW`).

**REQ-7.3** RLS on the underlying tables is sufficient to scope the view results; no additional RLS policy is required on the view itself.

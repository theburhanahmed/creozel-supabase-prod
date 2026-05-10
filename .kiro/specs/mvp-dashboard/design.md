# Design — mvp-dashboard

## Overview

The MVP dashboard wires four live data domains into the existing React component tree. The architecture is intentionally thin: no new state management library, no new HTTP client, no new abstraction layers. All data flows through the existing `@supabase/supabase-js` client in `src/lib/supabase.ts`, through service functions in `src/services/dashboardService.ts`, into page-level state managed with `useState` + `useCallback` + `useEffect`.

The Analytics page gains a time-range selector and per-platform breakdown, sourced from `analytics_events` and `scheduled_posts` queries added to a new `analyticsService.ts`.

A SQL migration creates the `analytics_overview` view that both pages depend on.

---

## Architecture

```
Dashboard.tsx
  └── loadDashboard() [useCallback]
        ├── getAnalyticsOverview()     → analytics_overview view (PostgREST)
        ├── getWalletBalance(userId)   → wallets table (PostgREST)
        ├── getRecentPosts(teamId, 5)  → scheduled_posts table (PostgREST)
        └── getOnboardingStatus(userId)→ social_connections, content_jobs,
                                         scheduled_posts (COUNT queries)

Analytics.tsx
  └── loadAnalytics(range) [useCallback]
        ├── getAnalyticsOverview()     → analytics_overview view (PostgREST)
        ├── getEngagementTrend(range)  → analytics_events table (PostgREST)
        └── getPlatformBreakdown(range)→ scheduled_posts table (PostgREST)
```

---

## File Map

| File | Status | Change |
|---|---|---|
| `src/services/dashboardService.ts` | Exists — complete | No changes needed |
| `src/services/analyticsService.ts` | Does not exist | Create — engagement trend + platform breakdown queries |
| `src/pages/Dashboard.tsx` | Exists — complete | No changes needed |
| `src/pages/Analytics.tsx` | Exists — partial | Add time-range selector, wire `analyticsService`, add per-platform breakdown |
| `src/types/index.ts` | Exists | Add `EngagementDataPoint`, `PlatformBreakdown` types |
| `supabase/migrations/YYYYMMDD_analytics_overview.sql` | Does not exist | Create — `analytics_overview` view DDL |

---

## Data Layer

### `analytics_overview` View

The view aggregates across five tables. RLS on each source table scopes results to the authenticated user's rows automatically — no view-level policy needed.

```sql
CREATE OR REPLACE VIEW analytics_overview AS
SELECT
  sp.team_id,
  t.name                                                        AS team_name,
  COUNT(sp.id)                                                  AS total_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'published')          AS published_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'scheduled')          AS scheduled_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'draft')              AS draft_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'failed')             AS failed_posts,
  COALESCE(SUM(cj.credits_used), 0)                            AS total_credits_used,
  COUNT(cj.id)                                                  AS total_jobs,
  COUNT(cj.id) FILTER (WHERE cj.status = 'completed')          AS completed_jobs,
  COUNT(pe.id) FILTER (WHERE pe.status IN ('pending','running'))AS active_pipelines,
  COUNT(pe.id)                                                  AS total_pipeline_runs,
  ROUND(
    100.0 * COUNT(pe.id) FILTER (WHERE pe.status = 'completed')
    / NULLIF(COUNT(pe.id), 0), 1
  )                                                             AS pipeline_success_rate,
  COUNT(DISTINCT sc.id) FILTER (WHERE sc.is_active = true)     AS connected_accounts
FROM scheduled_posts sp
LEFT JOIN teams t              ON t.id = sp.team_id
LEFT JOIN content_jobs cj      ON cj.team_id IS NOT DISTINCT FROM sp.team_id
LEFT JOIN pipeline_executions pe ON pe.team_id IS NOT DISTINCT FROM sp.team_id
LEFT JOIN social_connections sc  ON sc.team_id IS NOT DISTINCT FROM sp.team_id
GROUP BY sp.team_id, t.name;
```

> Note: For personal (non-team) users, `team_id` is `NULL` and the `IS NOT DISTINCT FROM` join correctly groups their rows.

### `analyticsService.ts` — New Functions

**`getEngagementTrend(range: 7 | 30 | 90, teamId?: string): Promise<EngagementDataPoint[]>`**

Queries `analytics_events` grouped by `DATE(created_at)` for the past `range` days. Returns an array of `{ date: string; count: number; event_type: string }` objects suitable for a Recharts `LineChart`.

```typescript
const since = new Date()
since.setDate(since.getDate() - range)

const { data, error } = await supabase
  .from('analytics_events')
  .select('created_at, event_type')
  .gte('created_at', since.toISOString())
  .order('created_at', { ascending: true })
```

Client-side grouping by `DATE(created_at)` produces the chart series. This avoids a custom RPC and keeps the query simple for MVP.

**`getPlatformBreakdown(range: 7 | 30 | 90, teamId?: string): Promise<PlatformBreakdown[]>`**

Queries `scheduled_posts` filtered by `status = 'published'` and `scheduled_at >= since`, grouped by `platform` client-side.

```typescript
const { data, error } = await supabase
  .from('scheduled_posts')
  .select('platform')
  .eq('status', 'published')
  .gte('scheduled_at', since.toISOString())
```

Returns `{ platform: SocialPlatform; count: number }[]`.

---

## Component Design

### Analytics.tsx — Changes

**Time-range selector** — a row of three buttons (7d / 30d / 90d) rendered above the charts. Selected range stored in `useState<7 | 30 | 90>(30)`. Changing the range triggers `loadAnalytics(newRange)`.

**Engagement Trend chart** — a Recharts `LineChart` using `EngagementDataPoint[]`. X-axis: date string. Y-axis: event count. One `Line` per `event_type` (content_generated, post_published, pipeline_run).

**Per-platform breakdown** — a horizontal `BarChart` with one bar per platform, showing published post count for the selected range.

**Empty state** — when `overview === null && engagementData.length === 0 && !loading`, render the existing empty-state illustration.

**Error handling** — wrap `loadAnalytics` in `try/catch (error: unknown)`, call `reportError`, set an error banner state. No thrown errors reach the component render path.

### Dashboard.tsx — No Changes

`Dashboard.tsx` and `dashboardService.ts` are already fully implemented and compliant with all requirements. No modifications needed.

---

## Type Additions (`src/types/index.ts`)

```typescript
// ─── Analytics (extended) ────────────────────────────────────────────────────

export interface EngagementDataPoint {
  date: string          // 'YYYY-MM-DD'
  count: number
  event_type: string    // 'content_generated' | 'post_published' | 'pipeline_run'
}

export interface PlatformBreakdown {
  platform: SocialPlatform
  count: number
}

export type AnalyticsRange = 7 | 30 | 90
```

---

## Error Handling Pattern

All service functions follow this pattern (already established in `dashboardService.ts`):

```typescript
export async function exampleQuery(): Promise<ResultType | null> {
  try {
    const { data, error } = await supabase.from('table').select('*')
    if (error) {
      reportError('analyticsService.exampleQuery', error)
      return null
    }
    return data
  } catch (error: unknown) {
    reportError('analyticsService.exampleQuery', error)
    return null
  }
}
```

---

## Migration File

Path: `supabase/migrations/<timestamp>_analytics_overview.sql`

Contains:
1. `CREATE OR REPLACE VIEW analytics_overview AS ...` (full DDL above)
2. A comment block explaining the view's purpose and column semantics

No `DOWN` migration is required for MVP; the view is non-destructive and idempotent.

---

## Out of Scope (Deferred to Post-MVP)

- AI-powered suggestions via Edge Function
- Real-time dashboard updates via Supabase Realtime subscriptions
- Per-post engagement metrics (likes, comments, shares) — requires platform API sync
- Credit consumption trend chart

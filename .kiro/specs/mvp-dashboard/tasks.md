# Tasks — mvp-dashboard

## Overview

Implementation tasks for wiring the Creozel dashboard and Analytics page to live Supabase data. `Dashboard.tsx` and `dashboardService.ts` are already complete — the remaining work is the database migration, the analytics service, and the Analytics page enhancements.

---

## Tasks

- [ ] 1. Create `analytics_overview` database migration
  - Create file `supabase/migrations/<timestamp>_analytics_overview.sql`
  - Write `CREATE OR REPLACE VIEW analytics_overview AS` with aggregations over `scheduled_posts`, `content_jobs`, `pipeline_executions`, `social_connections`, and `teams` (see design.md for full DDL)
  - Include `GROUP BY sp.team_id, t.name` so personal (NULL team) and team rows are separate
  - Use `IS NOT DISTINCT FROM` for nullable `team_id` joins
  - Add a comment block at the top of the file explaining the view's purpose
  - Verify the view columns match the `AnalyticsOverview` interface in `src/types/index.ts`
  - **Acceptance:** Running the migration against a clean DB produces the view; `SELECT * FROM analytics_overview` returns rows without error

- [ ] 2. Add `EngagementDataPoint`, `PlatformBreakdown`, and `AnalyticsRange` types
  - Open `frontend/src/types/index.ts`
  - Append the three new type definitions under the `// ─── Analytics ───` section (see design.md for exact definitions)
  - `EngagementDataPoint`: `{ date: string; count: number; event_type: string }`
  - `PlatformBreakdown`: `{ platform: SocialPlatform; count: number }`
  - `AnalyticsRange`: `type AnalyticsRange = 7 | 30 | 90`
  - **Acceptance:** `npx tsc --noEmit` exits 0 after this change

- [ ] 3. Create `analyticsService.ts` with engagement trend and platform breakdown queries
  - Create `frontend/src/services/analyticsService.ts`
  - Implement `getEngagementTrend(range: AnalyticsRange, teamId?: string): Promise<EngagementDataPoint[]>`
    - Compute `since` date as `new Date()` minus `range` days
    - Query `analytics_events` selecting `created_at, event_type` where `created_at >= since`
    - Apply `team_id` filter when provided; otherwise rely on RLS
    - Group results client-side by `DATE(created_at)` and `event_type`
    - Return `[]` on error after calling `reportError`
  - Implement `getPlatformBreakdown(range: AnalyticsRange, teamId?: string): Promise<PlatformBreakdown[]>`
    - Query `scheduled_posts` selecting `platform` where `status = 'published'` and `scheduled_at >= since`
    - Group client-side by `platform` and count
    - Return `[]` on error after calling `reportError`
  - All `catch` blocks: `catch (error: unknown)` + `reportError` from `src/utils/errorReporter`
  - No `any` types; import `supabase` from `../lib/supabase`
  - **Acceptance:** File compiles cleanly; both functions return typed arrays

- [ ] 4. Enhance `Analytics.tsx` — time-range selector
  - Open `frontend/src/pages/Analytics.tsx`
  - Add `useState<AnalyticsRange>(30)` for the selected range
  - Render a time-range selector row above the charts: three buttons labelled "7d", "30d", "90d"
  - Active button uses the brand green (`bg-[#3FE0A5] text-white`); inactive uses `glass-enhanced` styling
  - Changing the selected range calls `loadAnalytics(newRange)` immediately
  - Import `AnalyticsRange` from `../types`
  - **Acceptance:** Clicking each button updates the selected state and triggers a data reload

- [ ] 5. Enhance `Analytics.tsx` — wire engagement trend chart
  - Add `useState<EngagementDataPoint[]>([])` for trend data
  - In `loadAnalytics`, call `getEngagementTrend(range)` from `analyticsService`
  - Replace the existing static `postData` / `pipelineData` arrays with data derived from live queries
  - Render a Recharts `LineChart` (from existing `recharts` dependency) for engagement over time
    - X-axis: `date` field; Y-axis: `count`; one `Line` per unique `event_type`
    - Use `ResponsiveContainer width="100%" height={200}`
  - Keep the existing BarChart for Post Status Breakdown (sourced from `overview`)
  - **Acceptance:** Chart renders with real data; no hardcoded arrays remain in the component

- [ ] 6. Enhance `Analytics.tsx` — per-platform breakdown section
  - Add `useState<PlatformBreakdown[]>([])` for platform data
  - In `loadAnalytics`, call `getPlatformBreakdown(range)` from `analyticsService`
  - Render a horizontal Recharts `BarChart` below the existing charts
    - `layout="vertical"`, X-axis: count, Y-axis: platform name
    - Bar fill: `#3FE0A5`
  - Section heading: "Published by Platform"
  - When `platformData` is empty and not loading, show a small empty-state message: "No published posts in this period"
  - **Acceptance:** Section renders correctly for both populated and empty states

- [ ] 7. Enhance `Analytics.tsx` — error handling and empty state
  - Wrap `loadAnalytics` body in `try/catch (error: unknown)`
  - On error: call `reportError('Analytics.loadAnalytics', error)`, set an `error` state string
  - Render an error banner (matching the Dashboard error banner style) with a Retry button when `error` is set
  - When `overview === null && engagementData.length === 0 && platformData.length === 0 && !loading`, render the existing empty-state block (TrendingUpIcon + message)
  - Remove the existing `load` function and replace with `loadAnalytics` using `useCallback`
  - **Acceptance:** Simulating a network error shows the banner; the Retry button re-fetches

- [ ] 8. Verify TypeScript compliance
  - Run `npx tsc --noEmit` from the `frontend/` directory
  - Fix any type errors introduced by the new files and changes
  - Confirm no `any` types were introduced
  - Confirm all new `catch` blocks use `catch (error: unknown)`
  - **Acceptance:** `npx tsc --noEmit` exits 0 with no errors or warnings

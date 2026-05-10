# Tasks — mvp-analytics

- [ ] 1. Create `analyticsService.ts` with engagement trend and platform breakdown queries
  - Create `frontend/src/services/analyticsService.ts` if it doesn't exist
  - Implement `getEngagementTrend(range: AnalyticsRange, teamId?: string): Promise<EngagementDataPoint[]>`
  - Implement `getPlatformBreakdown(range: AnalyticsRange, teamId?: string): Promise<PlatformBreakdown[]>`
  - All catch blocks use `catch (error: unknown)` with `reportError`
  - **Validates:** Requirements 2.1, 3.1

- [ ] 2. Wire `Analytics.tsx` to live data
  - Add `useState<AnalyticsRange>(30)` for time range
  - Add time-range selector buttons (7d / 30d / 90d)
  - Replace any hardcoded chart data with calls to `analyticsService`
  - Wire `getAnalyticsOverview()` for overview stats
  - Wire `getEngagementTrend(range)` for the line chart
  - Wire `getPlatformBreakdown(range)` for the bar chart
  - **Validates:** Requirements 1.1–1.3, 2.1–2.3, 3.1–3.3

- [ ] 3. Add empty state
  - When all data is empty and not loading, show empty-state illustration
  - **Validates:** Requirement 1.4

- [ ] 4. TypeScript strict mode verification
  - Run `npx tsc --noEmit` from `frontend/`
  - Fix any errors in `Analytics.tsx` and `analyticsService.ts`
  - **Validates:** Requirement 4.1

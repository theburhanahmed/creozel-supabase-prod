# Design — mvp-analytics

## Overview

The Analytics page needs live data wired from `analyticsService.ts`. The design documents the data flow and chart configuration.

## Architecture

```
Analytics.tsx
  ├── useState<AnalyticsRange>(30)
  ├── loadAnalytics(range)
  │     ├── getAnalyticsOverview()          → analytics_overview view
  │     ├── getEngagementTrend(range)       → analytics_events grouped by day
  │     └── getPlatformBreakdown(range)     → scheduled_posts by platform
  └── Recharts charts
        ├── LineChart (engagement trend)
        └── BarChart (platform breakdown)
```

## Service Functions

### `getEngagementTrend(range, teamId?)`

```typescript
const since = new Date()
since.setDate(since.getDate() - range)

const { data } = await supabase
  .from('analytics_events')
  .select('created_at, event_type')
  .gte('created_at', since.toISOString())
  .order('created_at', { ascending: true })

// Group client-side by DATE(created_at) and event_type
```

### `getPlatformBreakdown(range, teamId?)`

```typescript
const { data } = await supabase
  .from('scheduled_posts')
  .select('platform')
  .eq('status', 'published')
  .gte('scheduled_at', since.toISOString())

// Group client-side by platform and count
```

## Correctness Properties

- **No hardcoded chart data**: All chart series are derived from live Supabase queries.
- **Time range filter is applied**: Changing the range selector triggers a new fetch with the updated `since` date.
- **Empty state shown**: When all queries return empty arrays, the empty-state illustration is shown.

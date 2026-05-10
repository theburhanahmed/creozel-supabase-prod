# Requirements — mvp-analytics

## Introduction

The Analytics page (`Analytics.tsx`) is implemented. The remaining gaps are: wiring the time-range selector to live `analytics_events` and `scheduled_posts` queries, replacing any hardcoded chart data with real Supabase data, and TypeScript strict mode compliance.

## Glossary

- **Analytics**: Page at `frontend/src/pages/Analytics.tsx`
- **analyticsService**: Service at `frontend/src/services/analyticsService.ts`
- **analytics_overview**: PostgreSQL view aggregating content generation and post stats per team
- **AnalyticsRange**: `7 | 30 | 90` days

## Requirements

### Requirement 1 — Live Analytics Data

**User Story:** As a user, I want the Analytics page to show real data from my account.

#### Acceptance Criteria

1. THE `Analytics` page SHALL load data from the `analytics_overview` view via PostgREST on mount.
2. THE page SHALL provide a time-range selector (7d / 30d / 90d) that filters the engagement trend and platform breakdown charts.
3. ALL chart data SHALL be derived from live Supabase queries — no hardcoded arrays.
4. WHEN no data exists for the selected range, THE page SHALL show an empty-state illustration.

### Requirement 2 — Engagement Trend Chart

**User Story:** As a user, I want to see my content engagement over time.

#### Acceptance Criteria

1. THE engagement trend chart SHALL query `analytics_events` grouped by day for the selected time range.
2. THE chart SHALL use Recharts `LineChart` with one line per `event_type`.
3. THE chart SHALL use `ResponsiveContainer` for responsive sizing.

### Requirement 3 — Per-Platform Breakdown

**User Story:** As a user, I want to see how many posts I've published per platform.

#### Acceptance Criteria

1. THE platform breakdown section SHALL query `scheduled_posts` filtered by `status = 'published'` and `scheduled_at >= since` for the selected range.
2. THE breakdown SHALL be displayed as a horizontal Recharts `BarChart`.
3. WHEN no published posts exist for the range, THE section SHALL show "No published posts in this period".

### Requirement 4 — TypeScript Strict Mode

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed, THE TypeScript compiler SHALL exit with code 0 with no errors in `Analytics.tsx` or `analyticsService.ts`.

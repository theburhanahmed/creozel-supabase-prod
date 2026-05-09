# Requirements: MVP Dashboard

## Overview
Replace the placeholder Dashboard page with a fully wired implementation that loads real data from Supabase. The dashboard is the first screen users see after login and must show meaningful stats, recent activity, and quick actions.

## Requirements

### 1. Stats Cards
- **REQ-1.1**: The dashboard must display four stat cards: Total Posts Published, Posts Scheduled, Credits Remaining, and Active Pipelines.
- **REQ-1.2**: Stats must be loaded from the `analytics_overview` Supabase view filtered by the user's active team.
- **REQ-1.3**: Credits Remaining must be loaded from the `wallets` table for the current user.
- **REQ-1.4**: While data is loading, each stat card must show a skeleton/loading state — not `'—'`.
- **REQ-1.5**: If no team is active (solo user), stats are scoped to the user's own content.

### 2. Recent Posts
- **REQ-2.1**: The dashboard must show the 5 most recent scheduled or published posts from `scheduled_posts`.
- **REQ-2.2**: Each post item shows: platform icon, content preview (truncated to 80 chars), scheduled/published time, and status badge.
- **REQ-2.3**: An empty state is shown when no posts exist, with a CTA to create content.

### 3. Quick Actions
- **REQ-3.1**: A "Create Content" button navigates to `/content`.
- **REQ-3.2**: A "View Calendar" button navigates to `/calendar`.
- **REQ-3.3**: A "Add Credits" button navigates to `/credits/add`.

### 4. Onboarding Checklist
- **REQ-4.1**: If `profiles.onboarding_completed = false`, show an onboarding checklist card.
- **REQ-4.2**: Checklist items: Connect a social account, Generate first content, Schedule first post.
- **REQ-4.3**: Each item shows a checkmark when completed (derived from data: social_connections count, content_jobs count, scheduled_posts count).
- **REQ-4.4**: When all items are checked, mark `onboarding_completed = true` via a Supabase update.

### 5. Error Handling
- **REQ-5.1**: If the analytics query fails, show an error state with a retry button — not a blank screen.
- **REQ-5.2**: Errors are reported via `reportError` from `src/utils/errorReporter.ts`.

### 6. Correctness Properties
- **PROP-1**: Stats shown on the dashboard must match the values in the database at the time of the last fetch.
- **PROP-2**: The credits value shown must equal `wallets.balance` for the authenticated user.
- **PROP-3**: The dashboard must never show data from a different user's account.

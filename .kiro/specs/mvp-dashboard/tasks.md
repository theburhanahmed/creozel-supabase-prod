# Tasks: MVP Dashboard

- [x] 1. Create errorReporter utility
  - [x] 1.1 Create `frontend/src/utils/errorReporter.ts` with `reportError` and `reportWarning` functions

- [x] 2. Create dashboard data service
  - [x] 2.1 Create `frontend/src/services/dashboardService.ts` using supabase client
  - [x] 2.2 Implement `getAnalyticsOverview(teamId?)` querying `analytics_overview` view
  - [x] 2.3 Implement `getWalletBalance(userId)` querying `wallets` table
  - [x] 2.4 Implement `getRecentPosts(teamId?, limit)` querying `scheduled_posts`
  - [x] 2.5 Implement `getOnboardingStatus(userId)` checking connections, jobs, posts counts

- [x] 3. Build Dashboard page
  - [x] 3.1 Replace `frontend/src/pages/Dashboard.tsx` with full implementation
  - [x] 3.2 Add loading skeleton for stat cards
  - [x] 3.3 Add stats grid wired to real data
  - [x] 3.4 Add recent posts list with platform icons and status badges
  - [x] 3.5 Add quick action buttons
  - [x] 3.6 Add onboarding checklist (conditional on onboarding_completed)
  - [x] 3.7 Add error state with retry button

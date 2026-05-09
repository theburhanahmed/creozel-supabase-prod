import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type {
  AnalyticsOverview,
  Wallet,
  ScheduledPost,
} from '../types'

export interface OnboardingStatus {
  hasConnectedAccount: boolean
  hasGeneratedContent: boolean
  hasScheduledPost: boolean
  isComplete: boolean
}

/**
 * Fetch aggregated dashboard stats from the `analytics_overview` view.
 *
 * - If `teamId` is provided, filters by `team_id` (REQ-1.2).
 * - If no `teamId`, scopes to the authenticated user's own content (REQ-1.5).
 *   The view is expected to expose a row per team; for solo users the row
 *   where `team_id IS NULL` (or matching the user's personal scope) is returned.
 */
export async function getAnalyticsOverview(
  teamId?: string,
): Promise<AnalyticsOverview | null> {
  try {
    let query = supabase
      .from('analytics_overview')
      .select('*')

    if (teamId) {
      // Team-scoped: filter by the active team (REQ-1.2)
      query = query.eq('team_id', teamId)
    } else {
      // Solo user: scope to rows where team_id is null (REQ-1.5)
      query = query.is('team_id', null)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      reportError('dashboardService.getAnalyticsOverview', error, { teamId })
      return null
    }

    return data as AnalyticsOverview | null
  } catch (error: unknown) {
    reportError('dashboardService.getAnalyticsOverview', error, { teamId })
    return null
  }
}

/**
 * Fetch the wallet record for the given user.
 * Selects the personal wallet (team_id IS NULL) to satisfy PROP-2:
 * the credits value shown must equal `wallets.balance` for the authenticated user.
 */
export async function getWalletBalance(userId: string): Promise<Wallet | null> {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .is('team_id', null)
      .maybeSingle()

    if (error) {
      reportError('dashboardService.getWalletBalance', error, { userId })
      return null
    }

    return data as Wallet | null
  } catch (error: unknown) {
    reportError('dashboardService.getWalletBalance', error, { userId })
    return null
  }
}

/**
 * Fetch the most recent scheduled or published posts for the dashboard feed.
 *
 * - Orders by `scheduled_at` descending (REQ-2.1).
 * - Limits to `limit` rows (default 5).
 * - Filters by `team_id` when provided; otherwise returns posts for the
 *   authenticated user (RLS enforces user isolation — PROP-3).
 */
export async function getRecentPosts(
  teamId?: string,
  limit = 5,
): Promise<ScheduledPost[]> {
  try {
    let query = supabase
      .from('scheduled_posts')
      .select('*')
      .in('status', ['scheduled', 'published'])
      .order('scheduled_at', { ascending: false })
      .limit(limit)

    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data, error } = await query

    if (error) {
      reportError('dashboardService.getRecentPosts', error, { teamId, limit })
      return []
    }

    return (data ?? []) as ScheduledPost[]
  } catch (error: unknown) {
    reportError('dashboardService.getRecentPosts', error, { teamId, limit })
    return []
  }
}

/**
 * Determine onboarding completion status for the current user (REQ-4.3).
 *
 * Runs three parallel COUNT queries:
 *   1. `social_connections` — has the user connected at least one account?
 *   2. `content_jobs`       — has the user generated any content?
 *   3. `scheduled_posts`    — has the user scheduled at least one post?
 *
 * RLS on each table ensures only the authenticated user's rows are visible,
 * satisfying PROP-3 (no cross-user data leakage).
 */
export async function getOnboardingStatus(
  userId: string,
): Promise<OnboardingStatus> {
  try {
    const [connectionsRes, jobsRes, postsRes] = await Promise.all([
      supabase
        .from('social_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true),
      supabase
        .from('content_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('scheduled_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    if (connectionsRes.error) {
      reportError('dashboardService.getOnboardingStatus', connectionsRes.error, { userId, query: 'social_connections' })
    }
    if (jobsRes.error) {
      reportError('dashboardService.getOnboardingStatus', jobsRes.error, { userId, query: 'content_jobs' })
    }
    if (postsRes.error) {
      reportError('dashboardService.getOnboardingStatus', postsRes.error, { userId, query: 'scheduled_posts' })
    }

    const hasConnectedAccount = (connectionsRes.count ?? 0) > 0
    const hasGeneratedContent = (jobsRes.count ?? 0) > 0
    const hasScheduledPost = (postsRes.count ?? 0) > 0
    const isComplete = hasConnectedAccount && hasGeneratedContent && hasScheduledPost

    return { hasConnectedAccount, hasGeneratedContent, hasScheduledPost, isComplete }
  } catch (error: unknown) {
    reportError('dashboardService.getOnboardingStatus', error, { userId })
    return {
      hasConnectedAccount: false,
      hasGeneratedContent: false,
      hasScheduledPost: false,
      isComplete: false,
    }
  }
}

/**
 * Mark onboarding as complete for the current user (REQ-4.4).
 */
export async function markOnboardingComplete(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', userId)

    if (error) {
      reportError('dashboardService.markOnboardingComplete', error, { userId })
    }
  } catch (error: unknown) {
    reportError('dashboardService.markOnboardingComplete', error, { userId })
  }
}

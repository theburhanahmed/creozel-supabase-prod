import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { SocialPlatform } from '../types'

export type AnalyticsRange = 7 | 30 | 90

export interface EngagementDataPoint {
  date: string       // 'YYYY-MM-DD'
  count: number
  event_type: string
}

export interface PlatformBreakdown {
  platform: SocialPlatform
  count: number
}

/**
 * Fetch engagement events grouped by day for the given time range.
 */
export async function getEngagementTrend(
  range: AnalyticsRange,
  teamId?: string,
): Promise<EngagementDataPoint[]> {
  try {
    const since = new Date()
    since.setDate(since.getDate() - range)

    let query = supabase
      .from('analytics_events')
      .select('created_at, event_type')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })

    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data, error } = await query
    if (error) {
      reportError('analyticsService.getEngagementTrend', error, { range, teamId })
      return []
    }

    // Group client-side by date + event_type
    const grouped: Record<string, Record<string, number>> = {}
    for (const row of data ?? []) {
      const date = (row.created_at as string).slice(0, 10)
      const type = (row.event_type as string) ?? 'unknown'
      if (!grouped[date]) grouped[date] = {}
      grouped[date][type] = (grouped[date][type] ?? 0) + 1
    }

    const result: EngagementDataPoint[] = []
    for (const [date, types] of Object.entries(grouped)) {
      for (const [event_type, count] of Object.entries(types)) {
        result.push({ date, count, event_type })
      }
    }

    return result.sort((a, b) => a.date.localeCompare(b.date))
  } catch (error: unknown) {
    reportError('analyticsService.getEngagementTrend', error, { range, teamId })
    return []
  }
}

/**
 * Fetch published post counts grouped by platform for the given time range.
 */
export async function getPlatformBreakdown(
  range: AnalyticsRange,
  teamId?: string,
): Promise<PlatformBreakdown[]> {
  try {
    const since = new Date()
    since.setDate(since.getDate() - range)

    let query = supabase
      .from('scheduled_posts')
      .select('platform')
      .eq('status', 'published')
      .gte('scheduled_at', since.toISOString())

    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data, error } = await query
    if (error) {
      reportError('analyticsService.getPlatformBreakdown', error, { range, teamId })
      return []
    }

    // Group client-side by platform
    const counts: Partial<Record<SocialPlatform, number>> = {}
    for (const row of data ?? []) {
      const platform = row.platform as SocialPlatform
      counts[platform] = (counts[platform] ?? 0) + 1
    }

    return Object.entries(counts).map(([platform, count]) => ({
      platform: platform as SocialPlatform,
      count: count ?? 0,
    }))
  } catch (error: unknown) {
    reportError('analyticsService.getPlatformBreakdown', error, { range, teamId })
    return []
  }
}

/**
 * Track an analytics event for the current user/team.
 */
export async function trackEvent(
  eventName: string,
  userId: string,
  teamId?: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('analytics_events').insert({
      user_id:    userId,
      team_id:    teamId ?? null,
      event_type: eventName,
      properties: properties ?? {},
    })
  } catch (error: unknown) {
    // Non-fatal — tracking failures should not break the user experience
    reportError('analyticsService.trackEvent', error, { eventName, userId })
  }
}

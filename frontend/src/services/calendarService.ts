import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { ScheduledPost, SocialPlatform } from '../types'

/**
 * Fetch all scheduled posts for the calendar view.
 * Optionally filter by team.
 */
export async function getScheduledPosts(
  teamId?: string,
  startDate?: string,
  endDate?: string,
): Promise<ScheduledPost[]> {
  try {
    let query = supabase
      .from('scheduled_posts')
      .select('*')
      .order('scheduled_at', { ascending: true })

    if (teamId) {
      query = query.eq('team_id', teamId)
    }
    if (startDate) {
      query = query.gte('scheduled_at', startDate)
    }
    if (endDate) {
      query = query.lte('scheduled_at', endDate)
    }

    const { data, error } = await query

    if (error) {
      reportError('calendarService.getScheduledPosts', error, { teamId })
      return []
    }

    return (data ?? []) as ScheduledPost[]
  } catch (error: unknown) {
    reportError('calendarService.getScheduledPosts', error, { teamId })
    return []
  }
}

/**
 * Reschedule a post by updating its scheduled_at timestamp.
 */
export async function reschedulePost(
  postId: string,
  newScheduledAt: string,
): Promise<ScheduledPost | null> {
  try {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .update({ scheduled_at: newScheduledAt, updated_at: new Date().toISOString() })
      .eq('id', postId)
      .select()
      .single()

    if (error) {
      reportError('calendarService.reschedulePost', error, { postId })
      return null
    }

    return data as ScheduledPost
  } catch (error: unknown) {
    reportError('calendarService.reschedulePost', error, { postId })
    return null
  }
}

/**
 * Create a new scheduled post.
 */
export async function createScheduledPost(
  userId: string,
  teamId: string | null,
  content: string,
  platform: SocialPlatform,
  scheduledAt: string,
  mediaUrls: string[] = [],
  socialConnectionId?: string,
): Promise<ScheduledPost | null> {
  try {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({
        user_id: userId,
        team_id: teamId ?? null,
        content,
        platform,
        scheduled_at: scheduledAt,
        status: 'scheduled',
        media_urls: mediaUrls,
        social_connection_id: socialConnectionId ?? null,
      })
      .select()
      .single()

    if (error) {
      reportError('calendarService.createScheduledPost', error, { userId, teamId })
      return null
    }
    return data as ScheduledPost
  } catch (error: unknown) {
    reportError('calendarService.createScheduledPost', error, { userId, teamId })
    return null
  }
}

/**
 * Fetch a single post by ID for the detail modal.
 */
export async function getPostDetail(postId: string): Promise<ScheduledPost | null> {
  try {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (error) {
      reportError('calendarService.getPostDetail', error, { postId })
      return null
    }

    return data as ScheduledPost
  } catch (error: unknown) {
    reportError('calendarService.getPostDetail', error, { postId })
    return null
  }
}

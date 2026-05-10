import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { SocialConnection, SocialPlatform } from '../types'

/**
 * Fetch all social connections for the current user/team.
 */
export async function getSocialConnections(
  userId: string,
  teamId?: string,
): Promise<SocialConnection[]> {
  try {
    let query = supabase
      .from('social_connections')
      .select('id, user_id, team_id, platform, account_name, account_id, token_expires_at, is_active, created_at')
      .order('created_at', { ascending: false })

    if (teamId) {
      query = query.eq('team_id', teamId)
    } else {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      reportError('socialService.getSocialConnections', error, { userId })
      return []
    }

    return (data ?? []) as SocialConnection[]
  } catch (error: unknown) {
    reportError('socialService.getSocialConnections', error, { userId })
    return []
  }
}

/**
 * Disconnect a social account — marks as inactive and cancels any scheduled posts.
 */
export async function disconnectSocialAccount(connectionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('social_connections')
      .update({ is_active: false })
      .eq('id', connectionId)

    if (error) {
      reportError('socialService.disconnectSocialAccount', error, { connectionId })
      return false
    }

    // Cancel any scheduled posts linked to this connection
    await supabase
      .from('scheduled_posts')
      .update({ status: 'failed', error_message: 'Social account disconnected' })
      .eq('social_connection_id', connectionId)
      .eq('status', 'scheduled')

    return true
  } catch (error: unknown) {
    reportError('socialService.disconnectSocialAccount', error, { connectionId })
    return false
  }
}

/**
 * Initiate OAuth connection for a platform.
 * Redirects to the oauth-connect Edge Function which handles the OAuth flow.
 */
export function getOAuthUrl(platform: SocialPlatform): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const redirectUri = encodeURIComponent(`${window.location.origin}/social-accounts`)
  return `${supabaseUrl}/functions/v1/oauth-connect?platform=${platform}&redirect_uri=${redirectUri}`
}

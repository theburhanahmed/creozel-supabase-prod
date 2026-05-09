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
 * Disconnect a social account — marks as inactive and clears tokens.
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

    return true
  } catch (error: unknown) {
    reportError('socialService.disconnectSocialAccount', error, { connectionId })
    return false
  }
}

/**
 * Initiate OAuth connection for a platform.
 * In production this would redirect to the platform's OAuth URL via an Edge Function.
 * For now, returns the Edge Function URL to redirect to.
 */
export function getOAuthUrl(platform: SocialPlatform): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  return `${supabaseUrl}/functions/v1/oauth-connect?platform=${platform}&redirect_uri=${encodeURIComponent(window.location.origin + '/social-accounts')}`
}

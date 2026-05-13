import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { SocialConnection, SocialPlatform } from '../types'

/**
 * Fetch all social connections for a team.
 * Returns [] immediately if teamId is null (no team selected).
 */
export async function getSocialConnections(
  teamId: string | null,
): Promise<SocialConnection[]> {
  if (teamId === null) return []

  try {
    const { data, error } = await supabase
      .from('social_connections')
      .select('id, user_id, team_id, platform, account_name, account_id, token_expires_at, is_active, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    if (error) {
      reportError('getSocialConnections [socialService.ts]', error)
      return []
    }

    return (data ?? []) as SocialConnection[]
  } catch (error: unknown) {
    reportError('getSocialConnections [socialService.ts]', error)
    return []
  }
}

/**
 * Disconnect a social account — marks as inactive and cancels any scheduled posts.
 * Filters by both id and team_id to enforce tenant isolation.
 */
export async function disconnectSocialAccount(
  connectionId: string,
  teamId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('social_connections')
      .update({ is_active: false })
      .eq('id', connectionId)
      .eq('team_id', teamId)

    if (error) {
      reportError('disconnectSocialAccount [socialService.ts]', error)
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
    reportError('disconnectSocialAccount [socialService.ts]', error)
    return false
  }
}

/**
 * Build the OAuth initiation URL for a platform.
 * Embeds platform, redirect_uri, user_id, and team_id in the state parameter.
 * teamId must be non-empty; throws if it is not.
 */
export function getOAuthUrl(
  platform: SocialPlatform,
  userId: string,
  teamId: string,
): string {
  if (!teamId) {
    throw new Error('teamId is required to initiate OAuth connection')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const redirectUri = `${window.location.origin}/social-accounts`
  const state = btoa(
    JSON.stringify({
      platform,
      redirect_uri: redirectUri,
      user_id: userId,
      team_id: teamId,
    }),
  )

  return `${supabaseUrl}/functions/v1/oauth-connect?platform=${platform}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
}

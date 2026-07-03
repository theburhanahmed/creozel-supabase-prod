/**
 * Edge Function: oauth-connect
 *
 * Handles OAuth2 connection flow for social platforms.
 *
 * Phase 1 — Initiation:
 *   GET /functions/v1/oauth-connect?platform=instagram&redirect_uri=https://...
 *   → Redirects to the platform's OAuth authorization URL
 *
 * Phase 2 — Callback:
 *   GET /functions/v1/oauth-connect?code=...&state=...
 *   → Exchanges code for tokens, stores in Supabase Vault, inserts social_connections row
 *   → Redirects to the original redirect_uri
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchPlatformAccountInfo(platform: string, accessToken: string): Promise<{ accountId: string; accountName: string }> {
  const fallback = { accountId: 'unknown', accountName: platform }
  try {
    if (platform === 'twitter') {
      const res = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return fallback
      const data = await res.json() as { data?: { id: string; username: string } }
      return { accountId: data.data?.id ?? fallback.accountId, accountName: data.data?.username ?? fallback.accountName }
    }
    if (platform === 'linkedin') {
      const res = await fetch('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return fallback
      const data = await res.json() as { id?: string; localizedFirstName?: string; localizedLastName?: string }
      return {
        accountId: data.id ?? fallback.accountId,
        accountName: `${data.localizedFirstName ?? ''} ${data.localizedLastName ?? ''}`.trim() || fallback.accountName,
      }
    }
    if (platform === 'facebook') {
      const res = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${accessToken}`)
      if (!res.ok) return fallback
      const data = await res.json() as { id?: string; name?: string }
      return { accountId: data.id ?? fallback.accountId, accountName: data.name ?? fallback.accountName }
    }
    if (platform === 'instagram') {
      const res = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`)
      if (!res.ok) return fallback
      const data = await res.json() as { id?: string; username?: string }
      return { accountId: data.id ?? fallback.accountId, accountName: data.username ?? fallback.accountName }
    }
    if (platform === 'youtube') {
      const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return fallback
      const data = await res.json() as { items?: Array<{ id: string; snippet?: { title?: string } }> }
      const item = data.items?.[0]
      return { accountId: item?.id ?? fallback.accountId, accountName: item?.snippet?.title ?? fallback.accountName }
    }
    if (platform === 'tiktok') {
      const res = await fetch(`https://open-api.tiktok.com/user/info/?fields=open_id,display_name&access_token=${accessToken}`)
      if (!res.ok) return fallback
      const data = await res.json() as { data?: { user?: { open_id: string; display_name: string } } }
      return {
        accountId: data.data?.user?.open_id ?? fallback.accountId,
        accountName: data.data?.user?.display_name ?? fallback.accountName,
      }
    }
  } catch (err) {
    console.error(`[oauth-connect] failed to fetch ${platform} account info:`, err)
  }
  return fallback
}

// Platform OAuth configuration
const PLATFORM_CONFIG: Record<string, {
  authUrl: string
  tokenUrl: string
  clientIdEnv: string
  clientSecretEnv: string
  scope: string
}> = {
  instagram: {
    authUrl:         'https://api.instagram.com/oauth/authorize',
    tokenUrl:        'https://api.instagram.com/oauth/access_token',
    clientIdEnv:     'INSTAGRAM_CLIENT_ID',
    clientSecretEnv: 'INSTAGRAM_CLIENT_SECRET',
    scope:           'user_profile,user_media',
  },
  youtube: {
    authUrl:         'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl:        'https://oauth2.googleapis.com/token',
    clientIdEnv:     'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    scope:           'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
  },
  twitter: {
    authUrl:         'https://twitter.com/i/oauth2/authorize',
    tokenUrl:        'https://api.twitter.com/2/oauth2/token',
    clientIdEnv:     'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
    scope:           'tweet.read tweet.write users.read offline.access',
  },
  facebook: {
    authUrl:         'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl:        'https://graph.facebook.com/v18.0/oauth/access_token',
    clientIdEnv:     'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
    scope:           'pages_manage_posts,pages_read_engagement',
  },
  linkedin: {
    authUrl:         'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl:        'https://www.linkedin.com/oauth/v2/accessToken',
    clientIdEnv:     'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    scope:           'r_liteprofile w_member_social',
  },
  tiktok: {
    authUrl:         'https://www.tiktok.com/auth/authorize/',
    tokenUrl:        'https://open-api.tiktok.com/oauth/access_token/',
    clientIdEnv:     'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    scope:           'user.info.basic,video.upload',
  },
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase    = createClient(supabaseUrl, serviceKey)

  try {
    const platform    = url.searchParams.get('platform')
    const code        = url.searchParams.get('code')
    const state       = url.searchParams.get('state')
    const redirectUri = url.searchParams.get('redirect_uri')

    // ── Phase 2: OAuth callback ───────────────────────────────────────────────
    if (code && state) {
      let stateData: { platform: string; redirect_uri: string; user_id: string; team_id: string }
      try {
        stateData = JSON.parse(atob(state)) as typeof stateData
      } catch {
        return new Response(
          JSON.stringify({ error: 'invalid_state' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Validate team_id before any database operations
      if (!stateData.team_id || typeof stateData.team_id !== 'string' || stateData.team_id.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'team_id_required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const config = PLATFORM_CONFIG[stateData.platform]
      if (!config) {
        return Response.redirect(`${stateData.redirect_uri}?error=unknown_platform`, 302)
      }

      const clientId     = Deno.env.get(config.clientIdEnv)
      const clientSecret = Deno.env.get(config.clientSecretEnv)

      if (!clientId || !clientSecret) {
        return Response.redirect(`${stateData.redirect_uri}?error=platform_not_configured`, 302)
      }

      // Exchange code for tokens
      const callbackUrl = `${supabaseUrl}/functions/v1/oauth-connect`
      const tokenRes = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          redirect_uri:  callbackUrl,
          client_id:     clientId,
          client_secret: clientSecret,
        }),
      })

      if (!tokenRes.ok) {
        const errText = await tokenRes.text()
        console.error('Token exchange failed:', errText)
        return Response.redirect(`${stateData.redirect_uri}?error=token_exchange_failed`, 302)
      }

      const tokens = await tokenRes.json() as {
        access_token: string
        refresh_token?: string
        expires_in?: number
      }

      // Fetch real platform account information using the access token.
      const accountInfo = await fetchPlatformAccountInfo(stateData.platform, tokens.access_token)
      const expiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null

      // Store tokens in Supabase Vault
      const secretName = `oauth_${stateData.platform}_${stateData.user_id}_${Date.now()}`
      const { data: vaultData, error: vaultError } = await supabase.rpc('vault.create_secret', {
        secret: JSON.stringify({
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          expires_at:    expiresAt,
        }),
        name: secretName,
      })

      if (vaultError) {
        console.error('Vault error:', vaultError)
        return Response.redirect(`${stateData.redirect_uri}?error=vault_error`, 302)
      }

      const vaultSecretId = (vaultData as { id: string } | null)?.id ?? null
      if (!vaultSecretId) {
        console.error('Vault did not return a secret id')
        return Response.redirect(`${stateData.redirect_uri}?error=vault_error`, 302)
      }

      // Insert social_connections row with the real platform account id.
      const { error: insertError } = await supabase.from('social_connections').upsert({
        user_id:             stateData.user_id,
        team_id:             stateData.team_id,
        platform:            stateData.platform,
        platform_account_id: accountInfo.accountId,
        account_name:        accountInfo.accountName,
        is_active:           true,
        vault_secret_id:     vaultSecretId,
        token_expires_at:    expiresAt,
      }, { onConflict: 'team_id,platform,platform_account_id' })

      if (insertError) {
        console.error('Insert error:', insertError)
        return Response.redirect(`${stateData.redirect_uri}?error=db_error`, 302)
      }

      return Response.redirect(`${stateData.redirect_uri}?connected=${stateData.platform}`, 302)
    }

    // ── Phase 1: Initiation ───────────────────────────────────────────────────
    if (!platform || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'platform and redirect_uri are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const config = PLATFORM_CONFIG[platform]
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Unsupported platform: ${platform}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const clientId = Deno.env.get(config.clientIdEnv)
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: `${platform} is not configured. Set ${config.clientIdEnv} in Edge Function secrets.` }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Extract user ID from JWT
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Build state parameter (base64-encoded JSON)
    const teamId = url.searchParams.get('team_id') ?? ''
    const statePayload = btoa(JSON.stringify({
      platform,
      redirect_uri: redirectUri,
      user_id:      user.id,
      team_id:      teamId,
    }))

    const callbackUrl = `${supabaseUrl}/functions/v1/oauth-connect`
    const authUrl = new URL(config.authUrl)
    authUrl.searchParams.set('client_id',     clientId)
    authUrl.searchParams.set('redirect_uri',  callbackUrl)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope',         config.scope)
    authUrl.searchParams.set('state',         statePayload)

    return Response.redirect(authUrl.toString(), 302)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('oauth-connect error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

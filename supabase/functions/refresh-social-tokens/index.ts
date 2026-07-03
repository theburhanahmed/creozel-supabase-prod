/**
 * Edge Function: refresh-social-tokens
 *
 * Queries social_connections rows with tokens expiring within the next 24 hours,
 * refreshes the access token via each platform's OAuth refresh endpoint, and
 * updates the Vault secret + token_expires_at in the database.
 *
 * Expected caller: pg_cron job with a shared CRON_SECRET header, or an admin
 * invoking the function directly with the service-role JWT.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const REFRESH_CONFIG: Record<string, {
  tokenUrl: string
  clientIdEnv: string
  clientSecretEnv: string
}> = {
  twitter: {
    tokenUrl:        'https://api.twitter.com/2/oauth2/token',
    clientIdEnv:     'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
  },
  linkedin: {
    tokenUrl:        'https://www.linkedin.com/oauth/v2/accessToken',
    clientIdEnv:     'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
  },
  youtube: {
    tokenUrl:        'https://oauth2.googleapis.com/token',
    clientIdEnv:     'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  facebook: {
    tokenUrl:        'https://graph.facebook.com/v18.0/oauth/access_token',
    clientIdEnv:     'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
  },
  instagram: {
    tokenUrl:        'https://graph.facebook.com/v18.0/oauth/access_token',
    clientIdEnv:     'INSTAGRAM_CLIENT_ID',
    clientSecretEnv: 'INSTAGRAM_CLIENT_SECRET',
  },
  tiktok: {
    tokenUrl:        'https://open-api.tiktok.com/oauth/refresh_token/',
    clientIdEnv:     'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
  },
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronSecret  = Deno.env.get('CRON_SECRET')
  const supabase    = createClient(supabaseUrl, serviceKey)

  // Authorize cron or service-role calls
  const authHeader = req.headers.get('Authorization') ?? ''
  const providedCronSecret = req.headers.get('X-Cron-Secret') ?? ''
  let authorized = false
  if (cronSecret && providedCronSecret === cronSecret) {
    authorized = true
  } else if (authHeader.startsWith('Bearer ')) {
    const jwt = authHeader.replace('Bearer ', '').trim()
    try {
      const payloadSegment = jwt.split('.')[1]
      if (payloadSegment) {
        const padded = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
        const decoded = atob(padded)
        const payload = JSON.parse(decoded) as Record<string, unknown>
        if (payload.role === 'service_role') authorized = true
      }
    } catch {
      authorized = false
    }
  }

  if (!authorized) {
    return new Response(
      JSON.stringify({ error: 'unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: connections, error: fetchError } = await supabase
      .from('social_connections')
      .select('id, platform, vault_secret_id, token_expires_at')
      .lt('token_expires_at', threshold)
      .eq('is_active', true)

    if (fetchError) {
      console.error('[refresh-social-tokens] fetch error:', fetchError.message)
      return new Response(
        JSON.stringify({ error: 'db_error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const rows = (connections ?? []) as Array<{
      id: string
      platform: string
      vault_secret_id: string
      token_expires_at: string | null
    }>

    let refreshed = 0
    let failed = 0

    for (const row of rows) {
      const config = REFRESH_CONFIG[row.platform]
      if (!config) continue

      const clientId     = Deno.env.get(config.clientIdEnv)
      const clientSecret = Deno.env.get(config.clientSecretEnv)
      if (!clientId || !clientSecret) {
        console.warn(`[refresh-social-tokens] missing credentials for ${row.platform}`)
        failed++
        continue
      }

      // Retrieve existing secret from Vault
      const { data: secretRow, error: secretError } = await supabase
        .from('vault.decrypted_secrets')
        .select('decrypted_secret')
        .eq('id', row.vault_secret_id)
        .single()

      if (secretError || !secretRow) {
        console.error(`[refresh-social-tokens] vault read error for ${row.id}:`, secretError?.message)
        failed++
        continue
      }

      let tokens: { access_token?: string; refresh_token?: string | null; expires_at?: string | null }
      try {
        tokens = JSON.parse((secretRow as { decrypted_secret: string }).decrypted_secret) as typeof tokens
      } catch {
        failed++
        continue
      }

      if (!tokens.refresh_token) {
        console.warn(`[refresh-social-tokens] no refresh token for ${row.id}`)
        failed++
        continue
      }

      // Refresh token
      let refreshRes: Response
      try {
        const body = new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id:     clientId,
          client_secret: clientSecret,
        })
        refreshRes = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })
      } catch (err) {
        console.error(`[refresh-social-tokens] network error for ${row.id}:`, err)
        failed++
        continue
      }

      if (!refreshRes.ok) {
        console.error(`[refresh-social-tokens] refresh failed for ${row.id}:`, await refreshRes.text())
        failed++
        continue
      }

      const newTokens = await refreshRes.json() as {
        access_token: string
        refresh_token?: string
        expires_in?: number
      }

      const newExpiresAt = newTokens.expires_in
        ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
        : null

      // Update Vault secret
      const { data: newVault, error: vaultError } = await supabase.rpc('vault.create_secret', {
        secret: JSON.stringify({
          access_token:  newTokens.access_token,
          refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
          expires_at:    newExpiresAt,
        }),
        name: `oauth_${row.platform}_refreshed_${Date.now()}`,
      })

      if (vaultError || !newVault) {
        console.error(`[refresh-social-tokens] vault write error for ${row.id}:`, vaultError?.message)
        failed++
        continue
      }

      // Update social_connections row
      const { error: updateError } = await supabase
        .from('social_connections')
        .update({
          vault_secret_id:  (newVault as { id: string }).id,
          token_expires_at: newExpiresAt,
        })
        .eq('id', row.id)

      if (updateError) {
        console.error(`[refresh-social-tokens] update error for ${row.id}:`, updateError.message)
        failed++
        continue
      }

      refreshed++
    }

    return new Response(
      JSON.stringify({ refreshed, failed, checked: rows.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[refresh-social-tokens] error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

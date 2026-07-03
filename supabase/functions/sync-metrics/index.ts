/**
 * Edge Function: sync-metrics
 *
 * Queries published posts with a stored platform_post_id, fetches engagement
 * metrics from each platform's API, and upserts rows into post_performance.
 *
 * Expected caller: pg_cron job with X-Cron-Secret header, or service-role JWT.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

interface SocialConnection {
  id: string
  platform: string
  vault_secret_id: string
}

interface ScheduledPost {
  id: string
  user_id: string
  team_id: string | null
  platform: string
  platform_post_id: string
  content: string
}

interface PlatformTokens {
  access_token: string
}

interface Metrics {
  likes: number
  shares: number
  comments: number
  views: number
  reach: number
  clicks: number
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronSecret  = Deno.env.get('CRON_SECRET')
  const supabase    = createClient(supabaseUrl, serviceKey)

  // ── Authorization ────────────────────────────────────────────────────────────
  async function isAuthorized(): Promise<boolean> {
    const providedCronSecret = req.headers.get('X-Cron-Secret') ?? ''
    if (cronSecret && providedCronSecret === cronSecret) return true

    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '').trim()
    if (!jwt) return false
    try {
      const payloadSegment = jwt.split('.')[1]
      if (!payloadSegment) return false
      const padded = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
      const decoded = atob(padded)
      const payload = JSON.parse(decoded) as Record<string, unknown>
      return payload.role === 'service_role'
    } catch {
      return false
    }
  }

  if (!(await isAuthorized())) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  async function getTokens(connection: SocialConnection): Promise<PlatformTokens | null> {
    const { data, error } = await supabase
      .from('vault.decrypted_secrets')
      .select('decrypted_secret')
      .eq('id', connection.vault_secret_id)
      .single()
    if (error || !data) return null
    try {
      return JSON.parse((data as { decrypted_secret: string }).decrypted_secret) as PlatformTokens
    } catch {
      return null
    }
  }

  async function syncTwitter(post: ScheduledPost, connection: SocialConnection): Promise<Metrics | null> {
    const tokens = await getTokens(connection)
    if (!tokens) return null
    try {
      const res = await fetch(
        `https://api.twitter.com/2/tweets/${post.platform_post_id}?tweet.fields=public_metrics,non_public_metrics`,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      )
      if (!res.ok) return null
      const data = await res.json() as { data?: { public_metrics?: Record<string, number> } }
      const m = data.data?.public_metrics ?? {}
      return {
        likes: m.like_count ?? 0,
        shares: m.retweet_count ?? 0,
        comments: m.reply_count ?? 0,
        views: m.impression_count ?? 0,
        reach: m.impression_count ?? 0,
        clicks: m.url_link_clicks ?? 0,
      }
    } catch (err) {
      console.error('[sync-metrics] twitter error:', err)
      return null
    }
  }

  async function syncFacebook(post: ScheduledPost, connection: SocialConnection): Promise<Metrics | null> {
    const tokens = await getTokens(connection)
    if (!tokens) return null
    try {
      const res = await fetch(
        `https://graph.facebook.com/${post.platform_post_id}?fields=reactions.summary(total_count),comments.summary(total_count),shares&access_token=${tokens.access_token}`
      )
      if (!res.ok) return null
      const data = await res.json() as {
        reactions?: { summary?: { total_count?: number } }
        comments?: { summary?: { total_count?: number } }
        shares?: { count?: number }
      }
      return {
        likes: data.reactions?.summary?.total_count ?? 0,
        shares: data.shares?.count ?? 0,
        comments: data.comments?.summary?.total_count ?? 0,
        views: 0,
        reach: 0,
        clicks: 0,
      }
    } catch (err) {
      console.error('[sync-metrics] facebook error:', err)
      return null
    }
  }

  async function syncLinkedIn(post: ScheduledPost, connection: SocialConnection): Promise<Metrics | null> {
    // LinkedIn engagement API requires organization access; skip for MVP
    console.log('[sync-metrics] linkedin metrics skipped for post', post.id)
    return null
  }

  async function syncPlatform(post: ScheduledPost, connection: SocialConnection): Promise<Metrics | null> {
    switch (post.platform) {
      case 'twitter': return syncTwitter(post, connection)
      case 'facebook': return syncFacebook(post, connection)
      case 'linkedin': return syncLinkedIn(post, connection)
      default: return null
    }
  }

  // ── Main processing ──────────────────────────────────────────────────────────
  try {
    const { data: posts, error } = await supabase
      .from('scheduled_posts')
      .select('id, user_id, team_id, platform, platform_post_id, content')
      .eq('status', 'published')
      .not('platform_post_id', 'is', null)
      .limit(50)

    if (error) {
      console.error('[sync-metrics] fetch error:', error.message)
      return new Response(
        JSON.stringify({ error: 'db_error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const rows = (posts ?? []) as ScheduledPost[]
    let synced = 0
    let failed = 0

    for (const post of rows) {
      const { data: connection } = await supabase
        .from('social_connections')
        .select('id, platform, vault_secret_id')
        .eq('team_id', post.team_id ?? '')
        .eq('platform', post.platform)
        .eq('is_active', true)
        .single()

      if (!connection) {
        failed++
        continue
      }

      const metrics = await syncPlatform(post, connection as SocialConnection)
      if (!metrics) {
        failed++
        continue
      }

      const { error: upsertError } = await supabase
        .from('post_performance')
        .upsert({
          scheduled_post_id: post.id,
          platform: post.platform,
          likes: metrics.likes,
          shares: metrics.shares,
          comments: metrics.comments,
          views: metrics.views,
          reach: metrics.reach,
          clicks: metrics.clicks,
          collected_at: new Date().toISOString(),
        }, { onConflict: 'scheduled_post_id' })

      if (upsertError) {
        console.error('[sync-metrics] upsert error:', upsertError.message)
        failed++
      } else {
        synced++
      }
    }

    return new Response(
      JSON.stringify({ synced, failed, checked: rows.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[sync-metrics] error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

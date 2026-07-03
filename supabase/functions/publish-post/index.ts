import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

interface ScheduledPostRow {
  id: string
  user_id: string
  team_id: string | null
  content: string
  platform: string
  scheduled_at: string
  status: string
  media_urls: string[]
  retry_count: number
  retry_at: string | null
  error_message: string | null
  social_connection_id: string | null
  content_hash: string | null
  pipeline_id: string | null
  content_job_id: string | null
}

interface SocialConnectionRow {
  id: string
  platform: string
  account_id: string
  vault_secret_id: string | null
}

interface OAuthTokens {
  access_token?: string
  refresh_token?: string
}

interface PublishResult {
  success: boolean
  platform_post_id?: string
  error?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronSecret = Deno.env.get('CRON_SECRET')
  const supabase = createClient(supabaseUrl, serviceKey)

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const incomingCronSecret = req.headers.get('X-Cron-Secret')
  const isCron = !!cronSecret && !!incomingCronSecret && cronSecret === incomingCronSecret

  let callerId: string | null = null
  if (!isCron) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    try {
      const userClient = createClient(supabaseUrl, serviceKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data, error } = await userClient.auth.getUser()
      if (error || !data?.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      callerId = data.user.id
    } catch (err) {
      console.error('[publish-post] auth validation error:', err)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: { scheduled_post_id?: string; dry_run?: boolean } = {}
  try {
    body = (await req.json()) as typeof body
  } catch (err) {
    console.error('[publish-post] invalid JSON body:', err)
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (isCron && !body.dry_run) {
    body = { dry_run: true }
  }

  if (!isCron && !body.scheduled_post_id) {
    return new Response(
      JSON.stringify({ error: 'scheduled_post_id is required for direct publishing' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  async function getVaultSecret(secretId: string): Promise<string | null> {
    const { data, error } = await supabase
      .rpc('get_vault_secret', { p_secret_id: secretId })
      .single<string>()
    if (error) {
      console.error('[publish-post] getVaultSecret error:', error)
      return null
    }
    return data
  }

  async function getConnectionForPost(post: ScheduledPostRow): Promise<SocialConnectionRow | null> {
    if (post.social_connection_id) {
      const { data, error } = await supabase
        .from('social_connections')
        .select('id, platform, account_id, vault_secret_id')
        .eq('id', post.social_connection_id)
        .eq('is_active', true)
        .maybeSingle()
      if (error) {
        console.error('[publish-post] connection lookup error:', error)
        return null
      }
      return data as SocialConnectionRow | null
    }

    // Fall back to any active connection for the same platform / scope.
    let query = supabase
      .from('social_connections')
      .select('id, platform, account_id, vault_secret_id')
      .eq('platform', post.platform)
      .eq('is_active', true)

    if (post.team_id) {
      query = query.eq('team_id', post.team_id)
    } else {
      query = query.is('team_id', null).eq('user_id', post.user_id)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[publish-post] fallback connection lookup error:', error)
      return null
    }
    return data as SocialConnectionRow | null
  }

  async function canUserManagePost(callerId: string, post: ScheduledPostRow): Promise<boolean> {
    if (post.user_id === callerId) return true
    if (!post.team_id) return false

    const { data } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', post.team_id)
      .eq('user_id', callerId)
      .in('role', ['owner', 'admin'])
      .maybeSingle()

    return !!data
  }

  async function publishTwitter(content: string, mediaUrls: string[], accessToken: string): Promise<PublishResult> {
    let text = content
    if (mediaUrls.length > 0) {
      // MVP: append media URLs inline; full native media upload requires
      // Twitter/X media upload endpoints and is handled separately.
      text += '\n\n' + mediaUrls.join('\n')
    }

    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Twitter/X publish failed: ${res.status} ${errText}` }
    }

    const data = (await res.json()) as { data?: { id?: string } }
    return { success: true, platform_post_id: data.data?.id }
  }

  async function publishLinkedIn(
    content: string,
    mediaUrls: string[],
    accessToken: string,
    accountId: string,
  ): Promise<PublishResult> {
    const shareContent: Record<string, unknown> = {
      shareCommentary: { text: content },
      shareMediaCategory: 'NONE',
    }

    if (mediaUrls.length > 0) {
      shareContent.shareMediaCategory = 'ARTICLE'
      shareContent.media = [{
        status: 'READY',
        originalUrl: mediaUrls[0],
        title: content.slice(0, 80),
        description: content.slice(0, 200),
      }]
    }

    const body = {
      author: `urn:li:person:${accountId}`,
      lifecycleState: 'PUBLISHED',
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
    }

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `LinkedIn publish failed: ${res.status} ${errText}` }
    }

    const data = (await res.json()) as { id?: string }
    const postId = data.id ?? res.headers.get('X-RestLi-Id') ?? undefined
    return { success: true, platform_post_id: postId }
  }

  async function getFacebookPageAccessToken(accessToken: string): Promise<{ pageId: string; pageToken: string } | null> {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`,
    )
    if (!res.ok) {
      console.error('[publish-post] Facebook accounts error:', await res.text())
      return null
    }
    const data = (await res.json()) as { data?: Array<{ id: string; access_token: string }> }
    const page = data.data?.[0]
    if (!page) return null
    return { pageId: page.id, pageToken: page.access_token }
  }

  async function publishFacebook(content: string, mediaUrls: string[], accessToken: string): Promise<PublishResult> {
    const page = await getFacebookPageAccessToken(accessToken)
    if (!page) {
      return { success: false, error: 'No Facebook page found for this account.' }
    }

    const params = new URLSearchParams({
      access_token: page.pageToken,
      message: content,
    })
    if (mediaUrls.length > 0) {
      params.set('link', mediaUrls[0])
    }

    const res = await fetch(`https://graph.facebook.com/v18.0/${page.pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Facebook publish failed: ${res.status} ${errText}` }
    }

    const data = (await res.json()) as { id?: string }
    return { success: true, platform_post_id: data.id }
  }

  async function publishInstagram(content: string, mediaUrls: string[], accessToken: string): Promise<PublishResult> {
    if (mediaUrls.length === 0) {
      return { success: false, error: 'Instagram requires an image or video.' }
    }

    const accountsRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=instagram_business_account,access_token&access_token=${accessToken}`,
    )
    if (!accountsRes.ok) {
      const errText = await accountsRes.text()
      return { success: false, error: `Instagram account lookup failed: ${accountsRes.status} ${errText}` }
    }
    const accountsData = (await accountsRes.json()) as {
      data?: Array<{
        id: string
        access_token?: string
        instagram_business_account?: { id: string }
      }>
    }

    const page = accountsData.data?.find((p) => p.instagram_business_account)
    const igUserId = page?.instagram_business_account?.id
    if (!igUserId || !page) {
      return { success: false, error: 'No Instagram Business account linked to the Facebook page.' }
    }

    const pageToken = page.access_token ?? accessToken
    const mediaUrl = mediaUrls[0]
    const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(mediaUrl)

    const createParams = new URLSearchParams({
      access_token: pageToken,
      caption: content,
    })
    if (isVideo) {
      createParams.set('media_type', 'VIDEO')
      createParams.set('video_url', mediaUrl)
    } else {
      createParams.set('image_url', mediaUrl)
    }

    const createRes = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media?${createParams.toString()}`,
      { method: 'POST' },
    )
    if (!createRes.ok) {
      const errText = await createRes.text()
      return { success: false, error: `Instagram media container failed: ${createRes.status} ${errText}` }
    }
    const createData = (await createRes.json()) as { id?: string }
    if (!createData.id) {
      return { success: false, error: 'Instagram did not return a media container ID.' }
    }

    const publishParams = new URLSearchParams({
      access_token: pageToken,
      creation_id: createData.id,
    })
    const publishRes = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish?${publishParams.toString()}`,
      { method: 'POST' },
    )
    if (!publishRes.ok) {
      const errText = await publishRes.text()
      return { success: false, error: `Instagram publish failed: ${publishRes.status} ${errText}` }
    }
    const publishData = (await publishRes.json()) as { id?: string }
    return { success: true, platform_post_id: publishData.id }
  }

  async function publishToPlatform(post: ScheduledPostRow, connection: SocialConnectionRow): Promise<PublishResult> {
    if (!connection.vault_secret_id) {
      return { success: false, error: 'Social connection has no stored token.' }
    }

    const secret = await getVaultSecret(connection.vault_secret_id)
    if (!secret) {
      return { success: false, error: 'Unable to decrypt social connection token.' }
    }

    let tokens: OAuthTokens
    try {
      tokens = JSON.parse(secret) as OAuthTokens
    } catch (err) {
      return { success: false, error: 'Stored token is not valid JSON.' }
    }

    if (!tokens.access_token) {
      return { success: false, error: 'No access token available for this social connection.' }
    }

    switch (post.platform) {
      case 'twitter':
        return await publishTwitter(post.content, post.media_urls, tokens.access_token)
      case 'linkedin':
        return await publishLinkedIn(post.content, post.media_urls, tokens.access_token, connection.account_id)
      case 'facebook':
        return await publishFacebook(post.content, post.media_urls, tokens.access_token)
      case 'instagram':
        return await publishInstagram(post.content, post.media_urls, tokens.access_token)
      case 'youtube':
      case 'tiktok':
        return { success: false, error: `${post.platform} video uploads are beyond MVP scope.` }
      default:
        return { success: false, error: `Unsupported platform: ${post.platform}` }
    }
  }

  async function finalizePost(post: ScheduledPostRow, result: PublishResult) {
    const now = new Date().toISOString()
    if (result.success) {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          platform_post_id: result.platform_post_id,
          error_message: null,
          retry_count: 0,
          retry_at: null,
          last_retry_at: now,
        })
        .eq('id', post.id)
      if (error) {
        console.error('[publish-post] finalize success error:', error)
      }
      return
    }

    const retryCount = post.retry_count + 1
    const updates: Record<string, unknown> = {
      error_message: result.error,
      retry_count: retryCount,
      last_retry_at: now,
    }

    if (retryCount >= 3) {
      updates.status = 'failed'
      updates.retry_at = null
    } else {
      updates.status = 'failed'
      const retryMinutes = 5 * retryCount
      updates.retry_at = new Date(Date.now() + retryMinutes * 60 * 1000).toISOString()
    }

    const { error } = await supabase.from('scheduled_posts').update(updates).eq('id', post.id)
    if (error) {
      console.error('[publish-post] finalize failure error:', error)
    }
  }

  async function processPost(post: ScheduledPostRow): Promise<PublishResult & { post_id: string }> {
    const connection = await getConnectionForPost(post)
    if (!connection) {
      const result: PublishResult = { success: false, error: 'No active social connection found for this post.' }
      await finalizePost(post, result)
      return { ...result, post_id: post.id }
    }

    const result = await publishToPlatform(post, connection)
    await finalizePost(post, result)
    return { ...result, post_id: post.id }
  }

  // ── Direct publishing ──────────────────────────────────────────────────────────
  if (body.scheduled_post_id) {
    const { data: post, error: postError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', body.scheduled_post_id)
      .maybeSingle()

    if (postError || !post) {
      return new Response(
        JSON.stringify({ error: postError?.message ?? 'Scheduled post not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const scheduledPost = post as ScheduledPostRow
    if (callerId && !(await canUserManagePost(callerId, scheduledPost))) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Atomically claim the row.
    const { data: claimedRows } = await supabase
      .rpc('claim_scheduled_post_by_id', { p_post_id: scheduledPost.id })
      .returns<ScheduledPostRow[]>()

    if (!claimedRows || claimedRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Post is not available for publishing' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const result = await processPost(claimedRows[0])
    return new Response(
      JSON.stringify({ success: result.success, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // ── Cron publishing ──────────────────────────────────────────────────────────
  const results: Array<PublishResult & { post_id: string }> = []
  while (true) {
    const { data: posts, error: claimError } = await supabase
      .rpc('claim_due_posts', { p_limit: 10 })
      .returns<ScheduledPostRow[]>()

    if (claimError) {
      console.error('[publish-post] claim_due_posts error:', claimError)
      break
    }
    if (!posts || posts.length === 0) break

    for (const post of posts) {
      try {
        const result = await processPost(post)
        results.push(result)
      } catch (err) {
        console.error('[publish-post] unexpected error processing post:', post.id, err)
        const errorMessage = err instanceof Error ? err.message : 'Unknown publishing error'
        await finalizePost(post, { success: false, error: errorMessage })
        results.push({ success: false, error: errorMessage, post_id: post.id })
      }
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})

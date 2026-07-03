import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const body = await req.json() as { team_id?: string; pipeline_id?: string; limit?: number }
    const teamId = body.team_id
    const pipelineId = body.pipeline_id

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'team_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch recent published posts with performance metrics
    const limit = Math.max(1, Math.min((body.limit ?? 20), 50))
    let postsQuery = supabase
      .from('scheduled_posts')
      .select('id, content, platform, scheduled_at, status, social_connection_id')
      .eq('team_id', teamId)
      .eq('status', 'published')
      .order('scheduled_at', { ascending: false })
      .limit(limit)

    if (pipelineId) {
      // Optionally narrow to posts linked to a pipeline (when we add that linkage)
      postsQuery = postsQuery
    }

    const { data: posts, error: postsError } = await postsQuery
    if (postsError) throw postsError

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], message: 'No published posts with performance data yet.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const postIds = posts.map((p) => p.id)

    const { data: metrics } = await supabase
      .from('post_performance')
      .select('*')
      .in('scheduled_post_id', postIds)
      .order('collected_at', { ascending: false })

    // Build a performance summary for each post
    const postSummaries = posts.map((post) => {
      const postMetrics = (metrics ?? []).filter((m) => m.scheduled_post_id === post.id)
      const latest = postMetrics[0] ?? null
      const previous = postMetrics[1] ?? null
      return {
        post_id: post.id,
        platform: post.platform,
        content: post.content,
        scheduled_at: post.scheduled_at,
        metrics: latest
          ? {
              likes: latest.likes,
              shares: latest.shares,
              comments: latest.comments,
              views: latest.views,
              reach: latest.reach,
              clicks: latest.clicks,
              collected_at: latest.collected_at,
            }
          : null,
        previous_metrics: previous
          ? {
              likes: previous.likes,
              shares: previous.shares,
              comments: previous.comments,
              views: previous.views,
              reach: previous.reach,
              clicks: previous.clicks,
            }
          : null,
      }
    })

    // Build prompt for OpenAI
    const summaryText = JSON.stringify(postSummaries, null, 2)
    const systemPrompt = `You are a content performance analyst. Given a list of published posts and their engagement metrics, generate 2-5 concrete improvement suggestions.
For each suggestion, return:
- type: "prompt_improvement" or "format_change" or "platform_focus" or "timing_change"
- title: short title (max 80 chars)
- description: 1-2 sentences explaining the insight
- prompt_change: a concrete revised prompt or template fragment that addresses the suggestion (optional, max 300 chars)

Return ONLY a JSON array of objects with keys: type, title, description, prompt_change. Do not include markdown.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Recent posts and metrics:\n${summaryText}` },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      throw new Error(`OpenAI error: ${err}`)
    }

    const openaiData = await openaiRes.json() as { choices: Array<{ message: { content: string } }> }
    const rawContent = openaiData.choices[0]?.message?.content ?? '[]'

    let suggestions: Array<{
      type: string
      title: string
      description: string
      prompt_change?: string
    }> = []
    try {
      suggestions = JSON.parse(rawContent) as typeof suggestions
      if (!Array.isArray(suggestions)) suggestions = []
    } catch {
      suggestions = []
    }

    // Insert suggestions into the database
    const inserts = suggestions.map((s) => ({
      team_id: teamId,
      pipeline_id: pipelineId ?? null,
      suggestion_type: s.type ?? 'prompt_improvement',
      title: s.title,
      description: s.description,
      prompt_change: s.prompt_change ?? null,
    }))

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from('content_suggestions').insert(inserts)
      if (insertError) throw insertError
    }

    return new Response(
      JSON.stringify({
        success: true,
        suggestions_generated: inserts.length,
        suggestions: inserts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[analyze-performance] error:', err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // ── Auth helpers ────────────────────────────────────────────────────────────
  async function getAuthenticatedUser(): Promise<{ id: string } | null> {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return null
    try {
      const userClient = createClient(supabaseUrl, serviceKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data, error } = await userClient.auth.getUser()
      if (error || !data.user) return null
      return { id: data.user.id }
    } catch (err) {
      console.error('[run-pipeline] auth validation error:', err)
      return null
    }
  }

  async function canAccessPipeline(userId: string, teamId: string | null): Promise<boolean> {
    if (!teamId) return false
    const { data } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    return data !== null
  }

  try {
    const caller = await getAuthenticatedUser()
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json() as { pipeline_id?: string }
    const pipelineId = body.pipeline_id

    if (!pipelineId) {
      return new Response(
        JSON.stringify({ error: 'pipeline_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Lookup the pipeline config
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', pipelineId)
      .single()

    if (pipelineError || !pipeline) {
      return new Response(
        JSON.stringify({ error: 'Pipeline not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!(await canAccessPipeline(caller.id, pipeline.team_id as string | null))) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const config = pipeline.config as Record<string, unknown> ?? {}
    const contentCategory = (config.contentCategory as string) ?? 'text'
    const contentFormat = (config.contentFormat as string) ?? 'blog_post'
    const tone = (config.tone as string) ?? 'professional'
    const promptTemplate = (config.promptTemplate as string) ?? pipeline.name
    const platforms = (config.platforms as string[] | null) ?? null

    // Resolve the team owner to use as the job user_id (pipelines do not store a user_id)
    const { data: team } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', pipeline.team_id as string)
      .single()

    const ownerId = (team as { owner_id?: string } | null)?.owner_id
    if (!ownerId) {
      return new Response(
        JSON.stringify({ error: 'Team owner not found for pipeline' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Determine credit cost (and unlimited tiers)
    const { data: pricing } = await supabase
      .from('pricing_config')
      .select('credits_cost, unlimited_for_plans, is_unlimited_default')
      .eq('content_type', contentCategory)
      .eq('is_active', true)
      .maybeSingle()

    let creditsToReserve = pricing?.credits_cost ?? 0
    let isUnlimited = pricing?.is_unlimited_default === true

    if (!isUnlimited && pricing?.unlimited_for_plans && (pricing.unlimited_for_plans as string[]).length > 0) {
      let subscriptionQuery = supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', ownerId)
        .eq('status', 'active')

      if (pipeline.team_id) {
        subscriptionQuery = subscriptionQuery.eq('team_id', pipeline.team_id as string)
      } else {
        subscriptionQuery = subscriptionQuery.is('team_id', null)
      }

      const { data: subscription } = await subscriptionQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const plan = (subscription as { plan?: string } | null)?.plan ?? 'free'
      if ((pricing.unlimited_for_plans as string[]).includes(plan)) {
        isUnlimited = true
      }
    }

    if (isUnlimited) creditsToReserve = 0

    // Reserve credits atomically
    if (creditsToReserve > 0) {
      const { data: reserved } = await supabase
        .rpc('reserve_credits', {
          p_user_id: ownerId,
          p_team_id: pipeline.team_id as string | null,
          p_amount:  creditsToReserve,
        })
        .single<boolean>()

      if (reserved !== true) {
        return new Response(
          JSON.stringify({ error: `Insufficient credits. Need ${creditsToReserve}.` }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // Create the content job
    const metadata = {
      contentCategory,
      contentFormat,
      tone,
      schemaVersion: '1',
      ...(config.advancedOptions as Record<string, unknown> ?? {}),
      ...(platforms ? { platforms } : {}),
    }

    const { data: job, error: jobError } = await supabase
      .from('content_jobs')
      .insert({
        user_id: ownerId,
        team_id: pipeline.team_id,
        type: contentCategory,
        status: 'pending',
        prompt: promptTemplate,
        credits_reserved: creditsToReserve,
        metadata,
      })
      .select()
      .single()

    if (jobError || !job) {
      // Release reserved credits on failure
      if (creditsToReserve > 0) {
        await supabase.rpc('release_credits', {
          p_user_id: ownerId,
          p_team_id: pipeline.team_id as string | null,
          p_amount:  creditsToReserve,
        })
      }

      return new Response(
        JSON.stringify({ error: jobError?.message ?? 'Failed to create content job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Trigger the generation Edge Function (fire-and-forget)
    supabase.functions
      .invoke('generate-content', { body: { job_id: job.id } })
      .catch((err: unknown) => {
        console.error('[run-pipeline] generate-content invoke failed:', err)
      })

    return new Response(
      JSON.stringify({
        success: true,
        pipeline_id: pipelineId,
        job_id: job.id,
        message: 'Content job created and generation triggered.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[run-pipeline] error:', err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

/**
 * Edge Function: retry-content-jobs
 *
 * Cron-triggered function that finds content_jobs that have been scheduled for
 * retry (status='pending', retry_at <= now(), retry_count < MAX_RETRIES) and
 * re-invokes the generate-content Edge Function for each one.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const MAX_RETRIES = 3

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronSecret  = Deno.env.get('CRON_SECRET')
  const supabase    = createClient(supabaseUrl, serviceKey)

  // Authorize cron or service-role
  const providedCronSecret = req.headers.get('X-Cron-Secret') ?? ''
  let authorized = false
  if (cronSecret && providedCronSecret === cronSecret) authorized = true
  else {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '').trim()
    if (jwt) {
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
  }

  if (!authorized) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const { data: jobs, error } = await supabase
      .from('content_jobs')
      .select('id')
      .eq('status', 'pending')
      .lt('retry_count', MAX_RETRIES)
      .lte('retry_at', new Date().toISOString())
      .limit(20)

    if (error) {
      console.error('[retry-content-jobs] fetch error:', error.message)
      return new Response(
        JSON.stringify({ error: 'db_error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let retried = 0
    for (const job of (jobs ?? []) as Array<{ id: string }>) {
      supabase.functions
        .invoke('generate-content', { body: { job_id: job.id } })
        .catch((err: unknown) => {
          console.error(`[retry-content-jobs] re-invoke failed for ${job.id}:`, err)
        })
      retried++
    }

    return new Response(
      JSON.stringify({ retried, checked: (jobs ?? []).length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[retry-content-jobs] error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

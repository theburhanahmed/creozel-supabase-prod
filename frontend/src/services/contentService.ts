import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { ContentFormatMetadataSchema, ContentJob, ContentType, PricingConfig } from '../types'

export interface CreateJobParams {
  type: ContentType
  prompt: string
  tone?: string
  teamId?: string
  brandVoice?: string
  voiceId?: string
  metadata?: ContentFormatMetadataSchema | undefined
}

/**
 * Insert a new content_jobs row, reserve credits, then invoke the Edge Function.
 * Returns the created job so the caller can subscribe to status changes.
 *
 * Billing is scoped to the active team when `teamId` is provided; otherwise the
 * user's personal wallet is used.
 */
export async function createContentJob(
  userId: string,
  params: CreateJobParams,
): Promise<ContentJob> {
  const teamId = params.teamId ?? null

  // 1. Get credit cost for this content type
  const { data: pricing } = await supabase
    .from('pricing_config')
    .select('credits_cost, unlimited_for_plans, is_unlimited_default')
    .eq('content_type', params.type)
    .eq('is_active', true)
    .maybeSingle()

  // 2. Determine if this content type is unlimited for the active scope.
  //    For the frontend we do a conservative check: if the pricing row says
  //    unlimited, we reserve 0 credits. The Edge Function re-verifies on its side.
  const isUnlimited = pricing?.is_unlimited_default === true ||
    (Array.isArray(pricing?.unlimited_for_plans) && (pricing?.unlimited_for_plans as string[]).length > 0)
  const creditsToReserve = isUnlimited ? 0 : (pricing?.credits_cost ?? 0)

  // 3. Reserve credits atomically for the active scope (skip when unlimited).
  //    The reserve_credits RPC locks the wallet row and returns false on insufficient balance.
  if (creditsToReserve > 0) {
    const { data: reserved } = await supabase
      .rpc('reserve_credits', {
        p_user_id: userId,
        p_team_id: teamId,
        p_amount:  creditsToReserve,
      })
      .single<boolean>()

    if (reserved !== true) {
      throw new Error(
        `Insufficient credits. You need ${creditsToReserve} credits.`,
      )
    }
  }

  // 4. Insert job row
  const { data: job, error: insertError } = await supabase
    .from('content_jobs')
    .insert({
      user_id:          userId,
      team_id:          teamId,
      type:             params.type,
      status:           'pending',
      prompt:           params.prompt,
      credits_reserved: creditsToReserve,
      metadata: {
        tone:        params.tone ?? 'professional',
        brand_voice: params.brandVoice ?? null,
        voice_id:    params.voiceId ?? null,
        // Spread all advanced option fields from the caller (task 14.1)
        ...(params.metadata ?? {}),
      },
    })
    .select()
    .single()

  if (insertError || !job) {
    // Release reserved credits on failure
    if (creditsToReserve > 0) {
      await supabase.rpc('release_credits', {
        p_user_id: userId,
        p_team_id: teamId,
        p_amount:  creditsToReserve,
      })
    }
    throw new Error(insertError?.message ?? 'Failed to create content job')
  }

  // 6. Invoke Edge Function (fire-and-forget — Realtime handles status updates)
  supabase.functions
    .invoke('generate-content', { body: { job_id: job.id } })
    .catch((err: unknown) => {
      reportError('contentService.createContentJob.invoke', err, { jobId: job.id })
    })

  return job as ContentJob
}

/**
 * Subscribe to real-time updates for a specific job.
 * Returns an unsubscribe function.
 */
export function subscribeToJob(
  jobId: string,
  onUpdate: (job: ContentJob) => void,
): () => void {
  const channel = supabase
    .channel(`job:${jobId}`)
    .on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'content_jobs',
        filter: `id=eq.${jobId}`,
      },
      (payload) => {
        onUpdate(payload.new as ContentJob)
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

/**
 * Cancel an in-progress job and release reserved credits.
 * Credits are released on the same wallet that reserved them (team or personal).
 */
export async function cancelJob(jobId: string, userId: string): Promise<void> {
  try {
    const { data: job } = await supabase
      .from('content_jobs')
      .select('credits_reserved, status, team_id')
      .eq('id', jobId)
      .single()

    if (!job || job.status === 'cancelled' || job.status === 'completed' || job.status === 'failed') return

    await supabase
      .from('content_jobs')
      .update({ status: 'cancelled', error_message: 'Cancelled by user' })
      .eq('id', jobId)

    // Release reserved credits on the scoped wallet atomically
    if ((job.credits_reserved ?? 0) > 0) {
      await supabase.rpc('release_credits', {
        p_user_id: userId,
        p_team_id: job.team_id,
        p_amount:  job.credits_reserved as number,
      })
    }
  } catch (error: unknown) {
    reportError('contentService.cancelJob', error, { jobId })
  }
}

/**
 * Fetch all pricing configs (for the credit cost display).
 */
export async function getPricingConfig(): Promise<PricingConfig[]> {
  try {
    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .eq('is_active', true)

    if (error) {
      reportError('contentService.getPricingConfig', error)
      return []
    }

    return (data ?? []) as PricingConfig[]
  } catch (error: unknown) {
    reportError('contentService.getPricingConfig', error)
    return []
  }
}

/**
 * Fetch recent content jobs for the current user.
 * When teamId is provided, filters to jobs belonging to that team.
 */
export async function getRecentJobs(
  userId: string,
  limit = 10,
  teamId?: string,
): Promise<ContentJob[]> {
  try {
    let query = supabase
      .from('content_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data, error } = await query

    if (error) {
      reportError('contentService.getRecentJobs', error, { userId })
      return []
    }

    return (data ?? []) as ContentJob[]
  } catch (error: unknown) {
    reportError('contentService.getRecentJobs', error, { userId })
    return []
  }
}

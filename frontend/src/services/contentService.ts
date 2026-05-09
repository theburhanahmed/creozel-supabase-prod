import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { ContentJob, ContentType, PricingConfig } from '../types'

export interface CreateJobParams {
  type: ContentType
  prompt: string
  tone?: string
  teamId?: string
  brandVoice?: string
  voiceId?: string
}

/**
 * Insert a new content_jobs row, reserve credits, then invoke the Edge Function.
 * Returns the created job so the caller can subscribe to status changes.
 */
export async function createContentJob(
  userId: string,
  params: CreateJobParams,
): Promise<ContentJob> {
  // 1. Get credit cost for this content type
  const { data: pricing } = await supabase
    .from('pricing_config')
    .select('credits_cost')
    .eq('content_type', params.type)
    .eq('is_active', true)
    .maybeSingle()

  const creditsToReserve = pricing?.credits_cost ?? 0

  // 2. Check wallet balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance, reserved')
    .eq('user_id', userId)
    .is('team_id', null)
    .maybeSingle()

  if (!wallet || wallet.balance < creditsToReserve) {
    throw new Error(
      `Insufficient credits. You need ${creditsToReserve} credits but have ${wallet?.balance ?? 0}.`,
    )
  }

  // 3. Reserve credits
  await supabase
    .from('wallets')
    .update({ reserved: wallet.reserved + creditsToReserve })
    .eq('id', wallet.id)

  // 4. Insert job row
  const { data: job, error: insertError } = await supabase
    .from('content_jobs')
    .insert({
      user_id:          userId,
      team_id:          params.teamId ?? null,
      type:             params.type,
      status:           'pending',
      prompt:           params.prompt,
      credits_reserved: creditsToReserve,
      metadata: {
        tone:        params.tone ?? 'professional',
        brand_voice: params.brandVoice ?? null,
        voice_id:    params.voiceId ?? null,
      },
    })
    .select()
    .single()

  if (insertError || !job) {
    // Release reserved credits on failure
    await supabase
      .from('wallets')
      .update({ reserved: wallet.reserved })
      .eq('id', wallet.id)
    throw new Error(insertError?.message ?? 'Failed to create content job')
  }

  // 5. Invoke Edge Function (fire-and-forget — Realtime handles status updates)
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
 */
export async function cancelJob(jobId: string, userId: string): Promise<void> {
  try {
    const { data: job } = await supabase
      .from('content_jobs')
      .select('credits_reserved, status')
      .eq('id', jobId)
      .single()

    if (!job || job.status === 'completed' || job.status === 'failed') return

    await supabase
      .from('content_jobs')
      .update({ status: 'failed', error_message: 'Cancelled by user' })
      .eq('id', jobId)

    // Release reserved credits
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, reserved')
      .eq('user_id', userId)
      .is('team_id', null)
      .maybeSingle()

    if (wallet) {
      await supabase
        .from('wallets')
        .update({ reserved: Math.max(0, wallet.reserved - job.credits_reserved) })
        .eq('id', wallet.id)
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
 */
export async function getRecentJobs(
  userId: string,
  limit = 10,
): Promise<ContentJob[]> {
  try {
    const { data, error } = await supabase
      .from('content_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

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

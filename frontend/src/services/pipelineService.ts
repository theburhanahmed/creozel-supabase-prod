import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { N8nConnection, N8nNode, N8nWorkflow, Pipeline, PipelineConfig, SocialPlatform } from '../types'

export interface SavePipelineInput {
  name: string
  description?: string
  schedule?: string | null
  config: PipelineConfig
}

export async function getPipelines(teamId: string): Promise<Pipeline[]> {
  try {
    const { data, error } = await supabase
      .from('pipelines')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    if (error) { reportError('pipelineService.getPipelines', error, { teamId }); return [] }
    return (data ?? []) as Pipeline[]
  } catch (error: unknown) {
    reportError('pipelineService.getPipelines', error, { teamId })
    return []
  }
}

export async function getPipeline(pipelineId: string, teamId: string): Promise<Pipeline | null> {
  try {
    const { data, error } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', pipelineId)
      .eq('team_id', teamId)
      .single()

    if (error) { reportError('pipelineService.getPipeline', error, { pipelineId, teamId }); return null }
    return data as Pipeline | null
  } catch (error: unknown) {
    reportError('pipelineService.getPipeline', error, { pipelineId, teamId })
    return null
  }
}

export async function createPipeline(teamId: string, input: SavePipelineInput): Promise<Pipeline | null> {
  try {
    const { data, error } = await supabase
      .from('pipelines')
      .insert({
        team_id: teamId,
        name: input.name,
        description: input.description ?? '',
        schedule: input.schedule ?? null,
        config: input.config,
      })
      .select()
      .single()

    if (error) { reportError('pipelineService.createPipeline', error, { teamId }); return null }
    return data as Pipeline
  } catch (error: unknown) {
    reportError('pipelineService.createPipeline', error, { teamId })
    return null
  }
}

export async function updatePipeline(pipelineId: string, teamId: string, input: Partial<SavePipelineInput>): Promise<Pipeline | null> {
  try {
    const update: Record<string, unknown> = {}
    if (input.name !== undefined) update.name = input.name
    if (input.description !== undefined) update.description = input.description
    if (input.schedule !== undefined) update.schedule = input.schedule
    if (input.config !== undefined) update.config = input.config

    const { data, error } = await supabase
      .from('pipelines')
      .update(update)
      .eq('id', pipelineId)
      .eq('team_id', teamId)
      .select()
      .single()

    if (error) { reportError('pipelineService.updatePipeline', error, { pipelineId }); return null }
    return data as Pipeline
  } catch (error: unknown) {
    reportError('pipelineService.updatePipeline', error, { pipelineId })
    return null
  }
}

export async function deletePipeline(pipelineId: string, teamId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pipelines')
      .delete()
      .eq('id', pipelineId)
      .eq('team_id', teamId)

    if (error) { reportError('pipelineService.deletePipeline', error, { pipelineId }); return false }
    return true
  } catch (error: unknown) {
    reportError('pipelineService.deletePipeline', error, { pipelineId })
    return false
  }
}

export async function checkPipelineNameExists(teamId: string, name: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('pipelines')
      .select('id')
      .eq('team_id', teamId)
      .eq('name', name)
      .maybeSingle()

    if (error) { reportError('pipelineService.checkPipelineNameExists', error, { teamId, name }); return false }
    return data !== null
  } catch (error: unknown) {
    reportError('pipelineService.checkPipelineNameExists', error, { teamId, name })
    return false
  }
}

/**
 * Generate a minimal n8n workflow JSON from a pipeline config.
 * The workflow triggers on a cron schedule and calls the Creozel run-pipeline
 * Edge Function with the pipeline id.
 *
 * After importing into n8n, the user must set:
 *   - The Supabase project URL and anon key (or a service-role key) for the HTTP Request.
 *   - The Authorization header to call the Edge Function.
 */
export function generateN8nWorkflow(
  pipelineId: string,
  pipelineName: string,
  schedule: string | null,
  supabaseFunctionsUrl: string,
): N8nWorkflow {
  const triggerId = cryptoRandomId()
  const runId = cryptoRandomId()

  const triggerNode: N8nNode = {
    id: triggerId,
    name: 'Schedule Trigger',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1,
    position: [250, 300],
    parameters: {
      rule: {
        interval: [
          schedule
            ? { field: 'cronExpression', expression: schedule }
            : { field: 'minutes', minutesInterval: 60 },
        ],
      },
    },
  }

  const runNode: N8nNode = {
    id: runId,
    name: 'Run Creozel Pipeline',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.1,
    position: [500, 300],
    parameters: {
      method: 'POST',
      url: `${supabaseFunctionsUrl}/run-pipeline`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: 'Bearer {{ $credentials.httpHeaderAuth.value }}' },
          { name: 'Content-Type', value: 'application/json' },
        ],
      },
      sendBody: true,
      contentType: 'json',
      body: {
        pipeline_id: pipelineId,
      },
      options: {
        timeout: 30000,
      },
    },
  }

  const connection: N8nConnection = { node: 'Run Creozel Pipeline', type: 'main', index: 0 }

  return {
    name: pipelineName,
    nodes: [triggerNode, runNode],
    connections: {
      'Schedule Trigger': {
        main: [[connection]],
      },
    },
    settings: { executionOrder: 'v1' },
    tags: ['creozel'],
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Build a simple human-readable schedule summary from a cron expression. */
export function describeSchedule(cron: string | null | undefined): string {
  if (!cron) return 'No schedule (manual runs)'

  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return cron

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  const isWildcard = (v: string) => v === '*'
  const isNumber = (v: string) => /^\d+$/.test(v)
  const isStep = (v: string) => /^\*\/\d+$/.test(v)

  const formatTime = (m: string, h: string): string | null => {
    if (!isNumber(m) || !isNumber(h)) return null
    const hNum = parseInt(h, 10)
    const mNum = parseInt(m, 10)
    if (hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) return null
    const period = hNum < 12 ? 'AM' : 'PM'
    const displayHour = hNum % 12 === 0 ? 12 : hNum % 12
    const displayMin = mNum === 0 ? '' : `:${String(mNum).padStart(2, '0')}`
    return `${displayHour}${displayMin} ${period}`
  }

  if (parts.every(isWildcard)) return 'Every minute'
  if (isStep(minute) && isWildcard(hour) && isWildcard(dayOfMonth) && isWildcard(month) && isWildcard(dayOfWeek)) {
    const n = parseInt(minute.split('/')[1], 10)
    return n === 1 ? 'Every minute' : `Every ${n} minutes`
  }
  if (isNumber(minute) && isNumber(hour) && isWildcard(dayOfMonth) && isWildcard(month) && isWildcard(dayOfWeek)) {
    const time = formatTime(minute, hour)
    return time ? `Every day at ${time}` : cron
  }
  if (isNumber(minute) && isNumber(hour) && isWildcard(dayOfMonth) && isWildcard(month) && isNumber(dayOfWeek)) {
    const time = formatTime(minute, hour)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dow = parseInt(dayOfWeek, 10)
    return time && dow >= 0 && dow <= 6 ? `Every ${days[dow]} at ${time}` : cron
  }
  return cron
}

/** Default pipeline config for the builder. */
export function defaultPipelineConfig(): PipelineConfig {
  return {
    contentCategory: 'text',
    contentFormat: 'blog_post',
    platform: 'LinkedIn',
    tone: 'Professional',
    length: {
      preset: 'medium',
      minWords: 150,
      maxWords: 500,
      durationSeconds: null,
      quantity: null,
      speakingRate: null,
    },
    advancedOptions: {
      model: 'gpt-4o',
      resolution: '1024x1024',
      style: 'photorealistic',
      negativePrompt: null,
      seed: null,
      voice: '21m00Tcm4TlvDq8ikWAM',
      pitch: null,
      stability: 50,
      outputFormat: null,
      aspectRatio: '16:9',
      includeBRoll: false,
      brandVoice: false,
      language: 'en',
    },
    platformConstraints: {
      characterLimit: null,
      aspectRatio: null,
      durationLimitSeconds: null,
      fileSizeLimitMb: null,
      acceptedFileFormats: [],
    },
  }
}

const ALL_PLATFORMS: SocialPlatform[] = ['instagram', 'youtube', 'twitter', 'facebook', 'linkedin', 'tiktok']

export function allPlatforms(): SocialPlatform[] {
  return ALL_PLATFORMS
}

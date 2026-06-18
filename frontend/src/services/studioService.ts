import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type {
  ContentCategory,
  ContentFormat,
  ContentFormatMetadataSchema,
  ContentJob,
  MediaItem,
  Pipeline,
  RepurposingSource,
  StudioPlatform,
  StudioTemplate,
  StudioTone,
} from '../types'

/**
 * Fetch templates visible to a team: system templates (is_system=true) plus
 * templates saved by the team (team_id=teamId), in a single .or() query.
 * Optionally filtered by content category and/or platform.
 */
export async function getTemplates(
  teamId: string,
  filters?: { category?: ContentCategory; platform?: StudioPlatform },
): Promise<StudioTemplate[]> {
  try {
    let query = supabase
      .from('studio_templates')
      .select('*')
      .or(`is_system.eq.true,team_id.eq.${teamId}`)
      .order('created_at', { ascending: false })

    if (filters?.category) {
      query = query.eq('content_category', filters.category)
    }

    if (filters?.platform) {
      query = query.eq('platform', filters.platform)
    }

    const { data, error } = await query

    if (error) {
      reportError('studioService.getTemplates', error, { teamId, filters })
      return []
    }

    return (data ?? []) as StudioTemplate[]
  } catch (error: unknown) {
    reportError('studioService.getTemplates', error, { teamId, filters })
    return []
  }
}

/**
 * Insert a new user-saved template row with is_system=false and team_id=teamId.
 * Returns the created StudioTemplate on success, or null on error.
 */
export async function saveTemplate(
  teamId: string,
  config: {
    name: string
    description?: string
    contentCategory: ContentCategory
    contentFormat: ContentFormat
    platform: StudioPlatform
    tone: StudioTone
    promptTemplate: string
    advancedOptions: ContentFormatMetadataSchema['advancedOptions']
  },
): Promise<StudioTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('studio_templates')
      .insert({
        name: config.name,
        description: config.description ?? '',
        content_category: config.contentCategory,
        content_format: config.contentFormat,
        platform: config.platform,
        tone: config.tone,
        prompt_template: config.promptTemplate,
        advanced_options: config.advancedOptions,
        is_system: false,
        team_id: teamId,
      })
      .select()
      .single()

    if (error) {
      reportError('studioService.saveTemplate', error, { teamId })
      return null
    }

    return data as StudioTemplate
  } catch (error: unknown) {
    reportError('studioService.saveTemplate', error, { teamId })
    return null
  }
}

/**
 * Delete a user-saved template by id.
 * Returns true on success, false on error.
 */
export async function deleteTemplate(templateId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('studio_templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      reportError('studioService.deleteTemplate', error, { templateId })
      return false
    }

    return true
  } catch (error: unknown) {
    reportError('studioService.deleteTemplate', error, { templateId })
    return false
  }
}

/**
 * Check whether a pipeline with the given name already exists for a team.
 * Returns true if a matching row is found, false if not or on error.
 */
export async function checkPipelineNameExists(
  teamId: string,
  name: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('pipelines')
      .select('id')
      .eq('team_id', teamId)
      .eq('name', name)
      .maybeSingle()

    if (error) {
      reportError('studioService.checkPipelineNameExists', error, { teamId, name })
      return false
    }

    return data !== null
  } catch (error: unknown) {
    reportError('studioService.checkPipelineNameExists', error, { teamId, name })
    return false
  }
}

/**
 * Insert a new pipeline row for the given team.
 * Returns the created Pipeline on success, or null on error.
 */
export async function savePipeline(
  teamId: string,
  config: {
    name: string
    description?: string
    schedule?: string | null
    pipelineConfig: Pipeline['config']
  },
): Promise<Pipeline | null> {
  try {
    const { data, error } = await supabase
      .from('pipelines')
      .insert({
        team_id: teamId,
        name: config.name,
        description: config.description ?? '',
        schedule: config.schedule ?? null,
        config: config.pipelineConfig,
      })
      .select()
      .single()

    if (error) {
      reportError('studioService.savePipeline', error, { teamId })
      return null
    }

    return data as Pipeline
  } catch (error: unknown) {
    reportError('studioService.savePipeline', error, { teamId })
    return null
  }
}

/**
 * Fetch the last 20 completed content_jobs and last 20 media_items for a team
 * in parallel, map each to a RepurposingSource, and return the combined array
 * sorted by recency (created_at descending).
 *
 * Legacy fallback per Requirement 18.7: if metadata.contentFormat is absent
 * (jobs created before this spec), format is set to null.
 *
 * Returns [] on error.
 */
export async function getRepurposingSources(
  teamId: string,
  userId: string,
  limit = 20,
): Promise<RepurposingSource[]> {
  try {
    const [jobsResult, mediaResult] = await Promise.all([
      supabase
        .from('content_jobs')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('media_items')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ])

    if (jobsResult.error) {
      reportError('studioService.getRepurposingSources.jobs', jobsResult.error, { teamId })
    }

    if (mediaResult.error) {
      reportError('studioService.getRepurposingSources.media', mediaResult.error, { teamId })
    }

    const jobs = (jobsResult.data ?? []) as ContentJob[]
    const mediaItems = (mediaResult.data ?? []) as MediaItem[]

    const jobSources: RepurposingSource[] = jobs.map((job) => ({
      type: 'job' as const,
      id: job.id,
      label: job.prompt ? job.prompt.slice(0, 80) : 'Untitled Job',
      format:
        ((job.metadata as { contentFormat?: ContentFormat } | null | undefined)
          ?.contentFormat) ?? null,
      previewUrl: job.result_url ?? null,
      promptExcerpt: job.prompt ? job.prompt.slice(0, 80) : null,
    }))

    const mediaSources: RepurposingSource[] = mediaItems.map((item) => ({
      type: 'media' as const,
      id: item.id,
      label: item.name || 'Untitled',
      format: null,
      previewUrl: item.public_url ?? item.thumbnail_url ?? null,
      promptExcerpt: null,
    }))

    const combined = [...jobSources, ...mediaSources]

    // Sort by recency: we need created_at from the original rows.
    // Build a lookup map for created_at values.
    const createdAtMap = new Map<string, string>()
    for (const job of jobs) {
      createdAtMap.set(job.id, job.created_at)
    }
    for (const item of mediaItems) {
      createdAtMap.set(item.id, item.created_at)
    }

    combined.sort((a, b) => {
      const aDate = createdAtMap.get(a.id) ?? ''
      const bDate = createdAtMap.get(b.id) ?? ''
      return bDate.localeCompare(aDate)
    })

    return combined
  } catch (error: unknown) {
    reportError('studioService.getRepurposingSources', error, { teamId, userId })
    return []
  }
}


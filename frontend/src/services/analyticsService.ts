import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { ContentSuggestion, Pipeline, PostPerformance } from '../types'

export async function getPostPerformance(teamId: string, limit = 50): Promise<PostPerformance[]> {
  try {
    const { data, error } = await supabase
      .from('post_performance')
      .select('*, scheduled_posts!inner(team_id)')
      .eq('scheduled_posts.team_id', teamId)
      .order('collected_at', { ascending: false })
      .limit(limit)

    if (error) { reportError('analyticsService.getPostPerformance', error, { teamId }); return [] }
    return (data ?? []) as PostPerformance[]
  } catch (error: unknown) {
    reportError('analyticsService.getPostPerformance', error, { teamId })
    return []
  }
}

export async function getContentSuggestions(teamId: string, includeApplied = false): Promise<ContentSuggestion[]> {
  try {
    let query = supabase
      .from('content_suggestions')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!includeApplied) {
      query = query.eq('applied', false)
    }

    const { data, error } = await query
    if (error) { reportError('analyticsService.getContentSuggestions', error, { teamId }); return [] }
    return (data ?? []) as ContentSuggestion[]
  } catch (error: unknown) {
    reportError('analyticsService.getContentSuggestions', error, { teamId })
    return []
  }
}

export async function applyContentSuggestion(
  suggestion: ContentSuggestion,
  pipelineId: string,
): Promise<Pipeline | null> {
  try {
    const { data: pipeline, error: fetchError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', pipelineId)
      .eq('team_id', suggestion.team_id)
      .single()

    if (fetchError || !pipeline) {
      reportError('analyticsService.applyContentSuggestion.fetch', fetchError, { suggestionId: suggestion.id, pipelineId })
      return null
    }

    const config = pipeline.config as Record<string, unknown> ?? {}
    const updatedConfig = {
      ...config,
      promptTemplate: suggestion.prompt_change ?? config.promptTemplate,
    }

    const [{ data: updatedPipeline, error: updateError }, { error: markError }] = await Promise.all([
      supabase
        .from('pipelines')
        .update({ config: updatedConfig })
        .eq('id', pipelineId)
        .eq('team_id', suggestion.team_id)
        .select()
        .single(),
      supabase
        .from('content_suggestions')
        .update({ applied: true, pipeline_id: pipelineId })
        .eq('id', suggestion.id)
        .eq('team_id', suggestion.team_id),
    ])

    if (updateError) { reportError('analyticsService.applyContentSuggestion.update', updateError, { pipelineId }); return null }
    if (markError) { reportError('analyticsService.applyContentSuggestion.mark', markError, { suggestionId: suggestion.id }) }

    return updatedPipeline as Pipeline
  } catch (error: unknown) {
    reportError('analyticsService.applyContentSuggestion', error, { suggestionId: suggestion.id, pipelineId })
    return null
  }
}

export async function markSuggestionApplied(suggestionId: string, teamId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('content_suggestions')
      .update({ applied: true })
      .eq('id', suggestionId)
      .eq('team_id', teamId)

    if (error) { reportError('analyticsService.markSuggestionApplied', error, { suggestionId }); return false }
    return true
  } catch (error: unknown) {
    reportError('analyticsService.markSuggestionApplied', error, { suggestionId })
    return false
  }
}

export async function analyzePerformance(teamId: string): Promise<{ suggestions: ContentSuggestion[]; error?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
    if (!supabaseUrl) {
      return { suggestions: [], error: 'Supabase URL not configured' }
    }

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!anonKey) {
      return { suggestions: [], error: 'Supabase anon key not configured' }
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/analyze-performance`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: teamId }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { suggestions: [], error: body || 'Analysis failed' }
    }

    const data = (await res.json()) as { suggestions?: ContentSuggestion[] }
    return { suggestions: (data.suggestions ?? []) as ContentSuggestion[] }
  } catch (error: unknown) {
    reportError('analyticsService.analyzePerformance', error, { teamId })
    return { suggestions: [], error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

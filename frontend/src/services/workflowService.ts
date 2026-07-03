import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { PipelineExecution } from '../types'

export interface PipelineStats {
  activePipelines: number
  totalExecutions: number
  successRate: number
  estimatedTimeSavedHours: number
}

export async function getPipelineStats(teamId?: string): Promise<PipelineStats> {
  try {
    let query = supabase.from('pipeline_executions').select('status, started_at, completed_at')
    if (teamId) query = query.eq('team_id', teamId)

    const { data, error } = await query
    if (error) { reportError('workflowService.getPipelineStats', error); return defaultStats() }

    const rows = data ?? []
    const total = rows.length
    const completed = rows.filter((r) => r.status === 'completed').length
    const active = rows.filter((r) => r.status === 'running' || r.status === 'pending').length
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Estimate time saved: assume each pipeline saves ~15 minutes
    const estimatedTimeSavedHours = Math.round((completed * 15) / 60)

    return { activePipelines: active, totalExecutions: total, successRate, estimatedTimeSavedHours }
  } catch (error: unknown) {
    reportError('workflowService.getPipelineStats', error)
    return defaultStats()
  }
}

function defaultStats(): PipelineStats {
  return { activePipelines: 0, totalExecutions: 0, successRate: 0, estimatedTimeSavedHours: 0 }
}

export async function getRecentExecutions(teamId?: string, limit = 10): Promise<PipelineExecution[]> {
  try {
    let query = supabase
      .from('pipeline_executions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (teamId) query = query.eq('team_id', teamId)

    const { data, error } = await query
    if (error) { reportError('workflowService.getRecentExecutions', error); return [] }
    return (data ?? []) as PipelineExecution[]
  } catch (error: unknown) {
    reportError('workflowService.getRecentExecutions', error)
    return []
  }
}

export async function pausePipeline(id: string, teamId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pipeline_executions')
      .update({ status: 'pending' })
      .eq('id', id)
      .eq('team_id', teamId)
    if (error) { reportError('workflowService.pausePipeline', error, { id }); return false }
    return true
  } catch (error: unknown) {
    reportError('workflowService.pausePipeline', error, { id })
    return false
  }
}

export async function resumePipeline(id: string, teamId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pipeline_executions')
      .update({ status: 'running' })
      .eq('id', id)
      .eq('team_id', teamId)
    if (error) { reportError('workflowService.resumePipeline', error, { id }); return false }
    return true
  } catch (error: unknown) {
    reportError('workflowService.resumePipeline', error, { id })
    return false
  }
}

export async function deletePipeline(id: string, teamId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pipeline_executions')
      .delete()
      .eq('id', id)
      .eq('team_id', teamId)
    if (error) { reportError('workflowService.deletePipeline', error, { id }); return false }
    return true
  } catch (error: unknown) {
    reportError('workflowService.deletePipeline', error, { id })
    return false
  }
}

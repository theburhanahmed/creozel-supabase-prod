import React, { useEffect, useState, useCallback } from 'react'
import {
  WorkflowIcon, PlayIcon, CheckCircleIcon, XCircleIcon, ClockIcon,
  TrendingUpIcon, RefreshCwIcon, PauseIcon, Trash2Icon,
} from 'lucide-react'
import {
  getPipelineStats, getRecentExecutions,
  pausePipeline, resumePipeline, deletePipeline,
  type PipelineStats,
} from '../../services/workflowService'
import { useAppContext } from '../../context/AppContext'
import type { PipelineExecution } from '../../types'

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
)

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  completed: { icon: <CheckCircleIcon size={14} />, color: 'text-green-500' },
  failed:    { icon: <XCircleIcon size={14} />,     color: 'text-red-500' },
  running:   { icon: <PlayIcon size={14} />,         color: 'text-blue-500' },
  pending:   { icon: <ClockIcon size={14} />,        color: 'text-yellow-500' },
}

export const WorkflowDashboard: React.FC = () => {
  const { activeTeam } = useAppContext()
  const teamId = activeTeam?.id
  const [stats, setStats]           = useState<PipelineStats | null>(null)
  const [executions, setExecutions] = useState<PipelineExecution[]>([])
  const [loading, setLoading]       = useState(true)
  const [actionInFlight, setActionInFlight] = useState<Set<string>>(new Set<string>())
  const [actionError, setActionError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [s, e] = await Promise.all([getPipelineStats(teamId), getRecentExecutions(teamId)])
    setStats(s)
    setExecutions(e)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const runAction = useCallback(async (id: string, fn: () => Promise<boolean>): Promise<void> => {
    setActionInFlight((prev) => new Set(prev).add(id))
    setActionError(null)
    const ok = await fn()
    setActionInFlight((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (!ok) {
      setActionError('Action failed. Please try again.')
    } else {
      void load()
    }
  }, [load])

  const statCards = [
    { label: 'Active Pipelines',  value: stats?.activePipelines,          icon: <WorkflowIcon size={20} />,    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
    { label: 'Total Executions',  value: stats?.totalExecutions,           icon: <PlayIcon size={20} />,        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
    { label: 'Success Rate',      value: stats ? `${stats.successRate}%` : undefined, icon: <TrendingUpIcon size={20} />, color: 'bg-green-100 dark:bg-green-900/30 text-green-600' },
    { label: 'Time Saved (hrs)',  value: stats?.estimatedTimeSavedHours,   icon: <ClockIcon size={20} />,       color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="glass-enhanced rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Workflow Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Monitor your automation pipelines</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors"
        >
          <RefreshCwIcon size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="glass-enhanced rounded-2xl p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>{card.icon}</div>
            {loading ? (
              <><Skeleton className="h-7 w-16 mb-1" /><Skeleton className="h-4 w-24" /></>
            ) : (
              <><p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value ?? 0}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p></>
            )}
          </div>
        ))}
      </div>

      <div className="glass-enhanced rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Recent Executions</h2>

        {actionError && (
          <div className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
            <XCircleIcon size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300 flex-1">{actionError}</p>
            <button
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-red-600 transition-colors"
              aria-label="Dismiss error"
            >
              <XCircleIcon size={14} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-10">
            <WorkflowIcon size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No pipeline executions yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Pipelines are managed via n8n. Connect n8n to start automating.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {executions.map((exec) => {
              const sc = STATUS_CONFIG[exec.status] ?? STATUS_CONFIG['pending']
              const isInFlight = actionInFlight.has(exec.id)
              return (
                <div key={exec.id} className="flex items-start gap-3 p-3 glass-light rounded-xl">
                  <div className={`flex items-center gap-1 ${sc.color} flex-shrink-0 mt-0.5`}>{sc.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{exec.pipeline_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(exec.created_at).toLocaleString()}</p>
                    {exec.status === 'failed' && (exec.step_failed || exec.error_message) && (
                      <div className="mt-1 space-y-0.5">
                        {exec.step_failed && (
                          <p className="text-xs text-red-500">
                            <span className="font-medium">Failed step:</span> {exec.step_failed}
                          </p>
                        )}
                        {exec.error_message && (
                          <p className="text-xs text-red-400 truncate max-w-xs">{exec.error_message}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(exec.status === 'running' || exec.status === 'pending') && (
                      <button
                        aria-label="Pause pipeline"
                        disabled={isInFlight}
                        onClick={() => void runAction(exec.id, () => teamId ? pausePipeline(exec.id, teamId) : Promise.resolve(false))}
                        className="p-1.5 rounded-lg text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 disabled:opacity-40 transition-colors"
                      >
                        <PauseIcon size={14} />
                      </button>
                    )}
                    {exec.status === 'pending' && (
                      <button
                        aria-label="Resume pipeline"
                        disabled={isInFlight}
                        onClick={() => void runAction(exec.id, () => teamId ? resumePipeline(exec.id, teamId) : Promise.resolve(false))}
                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40 transition-colors"
                      >
                        <PlayIcon size={14} />
                      </button>
                    )}
                    <button
                      aria-label="Delete pipeline"
                      disabled={isInFlight}
                      onClick={() => void runAction(exec.id, () => teamId ? deletePipeline(exec.id, teamId) : Promise.resolve(false))}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                    >
                      <Trash2Icon size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

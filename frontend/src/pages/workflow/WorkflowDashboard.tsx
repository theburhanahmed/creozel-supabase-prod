import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WorkflowIcon, PlayIcon, CheckCircleIcon, XCircleIcon, ClockIcon, TrendingUpIcon, RefreshCwIcon } from 'lucide-react'
import { getPipelineStats, getRecentExecutions, type PipelineStats } from '../../services/workflowService'
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
  const [stats, setStats]       = useState<PipelineStats | null>(null)
  const [executions, setExecutions] = useState<PipelineExecution[]>([])
  const [loading, setLoading]   = useState(true)

  const load = async () => {
    setLoading(true)
    const [s, e] = await Promise.all([getPipelineStats(), getRecentExecutions()])
    setStats(s)
    setExecutions(e)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const statCards = [
    { label: 'Active Pipelines',    value: stats?.activePipelines,          icon: <WorkflowIcon size={20} />,    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
    { label: 'Total Executions',    value: stats?.totalExecutions,           icon: <PlayIcon size={20} />,        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
    { label: 'Success Rate',        value: stats ? `${stats.successRate}%` : undefined, icon: <TrendingUpIcon size={20} />, color: 'bg-green-100 dark:bg-green-900/30 text-green-600' },
    { label: 'Time Saved (hrs)',    value: stats?.estimatedTimeSavedHours,   icon: <ClockIcon size={20} />,       color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="glass-enhanced rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Workflow Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Monitor your automation pipelines</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors">
          <RefreshCwIcon size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="glass-enhanced rounded-2xl p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>{card.icon}</div>
            {loading ? <><Skeleton className="h-7 w-16 mb-1" /><Skeleton className="h-4 w-24" /></> : (
              <><p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value ?? 0}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p></>
            )}
          </div>
        ))}
      </div>

      <div className="glass-enhanced rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Recent Executions</h2>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="flex gap-3"><Skeleton className="h-8 w-8 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-24" /></div></div>)}</div>
        ) : executions.length === 0 ? (
          <div className="text-center py-10">
            <WorkflowIcon size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No pipeline executions yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Pipelines are managed via n8n. Connect n8n to start automating.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {executions.map((exec) => {
              const sc = STATUS_CONFIG[exec.status] ?? STATUS_CONFIG.pending
              return (
                <div key={exec.id} className="flex items-center gap-3 p-3 glass-light rounded-xl">
                  <div className={`flex items-center gap-1 ${sc.color} flex-shrink-0`}>{sc.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{exec.pipeline_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(exec.created_at).toLocaleString()}</p>
                  </div>
                  {exec.status === 'failed' && exec.error_message && (
                    <p className="text-xs text-red-500 truncate max-w-xs">{exec.error_message}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

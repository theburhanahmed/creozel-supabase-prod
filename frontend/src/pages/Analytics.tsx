import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { TrendingUpIcon, RefreshCwIcon } from 'lucide-react'
import { getAnalyticsOverview } from '../services/dashboardService'
import type { AnalyticsOverview } from '../types'

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
)

export const Analytics: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading]   = useState(true)

  const load = async () => {
    setLoading(true)
    const data = await getAnalyticsOverview()
    setOverview(data)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  // Build simple chart data from overview
  const postData = overview ? [
    { name: 'Published', value: overview.published_posts },
    { name: 'Scheduled', value: overview.scheduled_posts },
    { name: 'Draft',     value: overview.draft_posts },
    { name: 'Failed',    value: overview.failed_posts },
  ] : []

  const pipelineData = overview ? [
    { name: 'Total Runs',  value: overview.total_pipeline_runs },
    { name: 'Active',      value: overview.active_pipelines },
    { name: 'Success %',   value: overview.pipeline_success_rate },
  ] : []

  return (
    <div className="space-y-6">
      <div className="glass-enhanced rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Performance overview for your content</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors">
          <RefreshCwIcon size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Posts',       value: overview?.total_posts },
          { label: 'Published',         value: overview?.published_posts },
          { label: 'Credits Used',      value: overview?.total_credits_used },
          { label: 'Connected Accounts',value: overview?.connected_accounts },
        ].map((stat) => (
          <div key={stat.label} className="glass-enhanced rounded-2xl p-5">
            {loading ? <><Skeleton className="h-7 w-16 mb-1" /><Skeleton className="h-4 w-24" /></> : (
              <><p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value ?? 0}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p></>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-enhanced rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Post Status Breakdown</h2>
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={postData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3FE0A5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-enhanced rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Pipeline Performance</h2>
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {overview === null && !loading && (
        <div className="glass-enhanced rounded-2xl p-12 text-center">
          <TrendingUpIcon size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No analytics data yet. Start publishing content to see insights here.</p>
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUpIcon, RefreshCwIcon, SparklesIcon, LightbulbIcon, CheckIcon, Loader2Icon } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { getAnalyticsOverview } from '../services/dashboardService'
import {
  analyzePerformance,
  getContentSuggestions,
  getPostPerformance,
  applyContentSuggestion,
  markSuggestionApplied,
} from '../services/analyticsService'
import { getPipelines } from '../services/pipelineService'
import type { AnalyticsOverview, ContentSuggestion, PostPerformance, Pipeline } from '../types'

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
)

export const Analytics: React.FC = () => {
  const { activeTeam } = useAppContext()
  const teamId = activeTeam?.id

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [posts, setPosts] = useState<PostPerformance[]>([])
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [applying, setApplying] = useState<Set<string>>(new Set())
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    setAnalysisError(null)
    const [o, p, s, pl] = await Promise.all([
      getAnalyticsOverview(teamId),
      getPostPerformance(teamId),
      getContentSuggestions(teamId),
      getPipelines(teamId),
    ])
    setOverview(o)
    setPosts(p)
    setSuggestions(s)
    setPipelines(pl)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  // Auto-refresh analytics data every 60 seconds
  useEffect(() => {
    if (!teamId) return
    const interval = setInterval(() => { void load() }, 60000)
    return () => clearInterval(interval)
  }, [teamId, load])

  const handleAnalyze = useCallback(async () => {
    if (!teamId) return
    setAnalyzing(true)
    setAnalysisError(null)
    const result = await analyzePerformance(teamId)
    setAnalyzing(false)
    if (result.error) {
      setAnalysisError(result.error)
    } else {
      void load()
    }
  }, [teamId, load])

  const handleApply = useCallback(async (suggestion: ContentSuggestion) => {
    if (!teamId) return
    const pipelineId = selectedPipeline[suggestion.id]
    if (!pipelineId) return

    setApplying((prev) => new Set(prev).add(suggestion.id))
    const result = await applyContentSuggestion(suggestion, pipelineId)
    setApplying((prev) => {
      const next = new Set(prev)
      next.delete(suggestion.id)
      return next
    })

    if (result) {
      setSuggestions((prev) => prev.map((s) => s.id === suggestion.id ? { ...s, applied: true } : s))
    } else {
      await markSuggestionApplied(suggestion.id, teamId)
      setSuggestions((prev) => prev.map((s) => s.id === suggestion.id ? { ...s, applied: true } : s))
    }
  }, [teamId, selectedPipeline])

  const handleDismiss = useCallback(async (suggestion: ContentSuggestion) => {
    if (!teamId) return
    const ok = await markSuggestionApplied(suggestion.id, teamId)
    if (ok) {
      setSuggestions((prev) => prev.map((s) => s.id === suggestion.id ? { ...s, applied: true } : s))
    }
  }, [teamId])

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

  if (!teamId) {
    return (
      <div className="space-y-6">
        <div className="glass-enhanced rounded-2xl p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Select a team to view analytics.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass-enhanced rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Performance overview and improvement suggestions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleAnalyze()}
            disabled={analyzing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {analyzing ? <Loader2Icon size={16} className="animate-spin" /> : <SparklesIcon size={16} />}
            {analyzing ? 'Analyzing...' : 'Analyze Performance'}
          </button>
          <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors">
            <RefreshCwIcon size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {analysisError && (
        <div className="glass-enhanced rounded-2xl p-4 border border-red-200 dark:border-red-800/30 bg-red-50 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{analysisError}</p>
        </div>
      )}

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

      {/* Suggestions */}
      <div className="glass-enhanced rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <LightbulbIcon size={18} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Improvement Suggestions</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : suggestions.filter((s) => !s.applied).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">No open suggestions yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click Analyze Performance to generate AI insights from your published posts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.filter((s) => !s.applied).map((suggestion) => {
              const isApplying = applying.has(suggestion.id)
              const pipelineId = selectedPipeline[suggestion.id]
              return (
                <div key={suggestion.id} className="p-4 glass-light rounded-xl border border-gray-100 dark:border-white/5">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{suggestion.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{suggestion.description}</p>
                      {suggestion.prompt_change && (
                        <p className="text-xs text-[#3FE0A5] mt-2 font-mono bg-[#3FE0A5]/10 dark:bg-[#3FE0A5]/10 px-2 py-1 rounded">
                          {suggestion.prompt_change}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={pipelineId ?? ''}
                        onChange={(e) => setSelectedPipeline((prev) => ({ ...prev, [suggestion.id]: e.target.value }))}
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                      >
                        <option value="">Select pipeline...</option>
                        {pipelines.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => void handleApply(suggestion)}
                        disabled={isApplying || !pipelineId}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#3FE0A5] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
                      >
                        {isApplying ? <Loader2Icon size={12} className="animate-spin" /> : <CheckIcon size={12} />}
                        Apply
                      </button>
                      <button
                        onClick={() => void handleDismiss(suggestion)}
                        disabled={isApplying}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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

      {/* Post performance table */}
      <div className="glass-enhanced rounded-2xl p-6 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Recent Post Performance</h2>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUpIcon size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No performance data yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Metrics appear once posts are published and synced.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-white/10">
                <tr>
                  <th className="py-2 pr-4">Platform</th>
                  <th className="py-2 pr-4">Likes</th>
                  <th className="py-2 pr-4">Shares</th>
                  <th className="py-2 pr-4">Comments</th>
                  <th className="py-2 pr-4">Views</th>
                  <th className="py-2 pr-4">Reach</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2">Collected</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-gray-50 dark:border-white/5 last:border-0">
                    <td className="py-2 pr-4 font-medium capitalize">{post.platform}</td>
                    <td className="py-2 pr-4">{post.likes}</td>
                    <td className="py-2 pr-4">{post.shares}</td>
                    <td className="py-2 pr-4">{post.comments}</td>
                    <td className="py-2 pr-4">{post.views}</td>
                    <td className="py-2 pr-4">{post.reach}</td>
                    <td className="py-2 pr-4">{post.clicks}</td>
                    <td className="py-2 text-xs text-gray-400">{new Date(post.collected_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

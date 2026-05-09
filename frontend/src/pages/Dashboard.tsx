import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  SparklesIcon,
  CalendarIcon,
  CreditCardIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  CircleIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  PlusIcon,
  InstagramIcon,
  YoutubeIcon,
  TwitterIcon,
  LinkedinIcon,
  FacebookIcon,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import {
  getAnalyticsOverview,
  getWalletBalance,
  getRecentPosts,
  getOnboardingStatus,
  markOnboardingComplete,
  type OnboardingStatus,
} from '../services/dashboardService'
import { reportError } from '../utils/errorReporter'
import type { AnalyticsOverview, ScheduledPost, SocialPlatform } from '../types'

// ─── Platform icon map ────────────────────────────────────────────────────────
const PLATFORM_ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: <InstagramIcon size={16} className="text-pink-500" />,
  youtube:   <YoutubeIcon   size={16} className="text-red-500" />,
  twitter:   <TwitterIcon   size={16} className="text-sky-400" />,
  facebook:  <FacebookIcon  size={16} className="text-blue-600" />,
  linkedin:  <LinkedinIcon  size={16} className="text-blue-500" />,
  tiktok:    <span className="text-xs font-bold text-gray-900 dark:text-white">TT</span>,
}

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: 'bg-pink-100 dark:bg-pink-900/30',
  youtube:   'bg-red-100 dark:bg-red-900/30',
  twitter:   'bg-sky-100 dark:bg-sky-900/30',
  facebook:  'bg-blue-100 dark:bg-blue-900/30',
  linkedin:  'bg-blue-100 dark:bg-blue-900/30',
  tiktok:    'bg-gray-100 dark:bg-gray-800',
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
)

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: number | string | undefined
  icon: React.ReactNode
  color: string
  loading: boolean
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, loading }) => (
  <div className="glass-enhanced rounded-2xl p-6 flex flex-col gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
      {icon}
    </div>
    {loading ? (
      <>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-28" />
      </>
    ) : (
      <>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">
          {value ?? 0}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </>
    )}
  </div>
)

// ─── Onboarding Checklist ─────────────────────────────────────────────────────
const OnboardingChecklist: React.FC<{ status: OnboardingStatus }> = ({ status }) => {
  const items = [
    { label: 'Connect a social account', done: status.hasConnectedAccount, href: '/social-accounts' },
    { label: 'Generate your first content', done: status.hasGeneratedContent, href: '/content' },
    { label: 'Schedule your first post', done: status.hasScheduledPost, href: '/calendar' },
  ]

  return (
    <div className="glass-enhanced rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        🚀 Get started with Creozel
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.done ? '#' : item.href}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
              item.done
                ? 'opacity-60 cursor-default'
                : 'hover:bg-white/50 dark:hover:bg-white/5 cursor-pointer'
            }`}
          >
            {item.done ? (
              <CheckCircleIcon size={20} className="text-[#3FE0A5] flex-shrink-0" />
            ) : (
              <CircleIcon size={20} className="text-gray-400 flex-shrink-0" />
            )}
            <span
              className={`text-sm font-medium ${
                item.done
                  ? 'line-through text-gray-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Recent Posts ─────────────────────────────────────────────────────────────
const RecentPosts: React.FC<{ posts: ScheduledPost[]; loading: boolean }> = ({
  posts,
  loading,
}) => (
  <div className="glass-enhanced rounded-2xl p-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Recent Posts
      </h2>
      <Link
        to="/calendar"
        className="text-sm text-[#3FE0A5] hover:text-[#38B897] font-medium transition-colors"
      >
        View all
      </Link>
    </div>

    {loading ? (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    ) : posts.length === 0 ? (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
          No posts yet. Start creating content!
        </p>
        <Link
          to="/content"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
        >
          <PlusIcon size={16} />
          Create Content
        </Link>
      </div>
    ) : (
      <div className="space-y-3">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                PLATFORM_COLORS[post.platform]
              }`}
            >
              {PLATFORM_ICONS[post.platform]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {post.content.length > 80
                  ? `${post.content.slice(0, 80)}…`
                  : post.content}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    STATUS_STYLES[post.status] ?? STATUS_STYLES.draft
                  }`}
                >
                  {post.status}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(post.scheduled_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const { user } = useAppContext()

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [recentPosts, setRecentPosts] = useState<ScheduledPost[]>([])
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const [ov, wallet, posts, ob] = await Promise.all([
        getAnalyticsOverview(),
        getWalletBalance(user.id),
        getRecentPosts(undefined, 5),
        getOnboardingStatus(user.id),
      ])

      setOverview(ov)
      setWalletBalance(wallet?.balance ?? 0)
      setRecentPosts(posts)
      setOnboarding(ob)

      // Auto-complete onboarding when all steps done
      if (ob.isComplete && !user.onboarding_completed) {
        await markOnboardingComplete(user.id)
      }
    } catch (err: unknown) {
      reportError('Dashboard.loadDashboard', err)
      setError('Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const showOnboarding =
    onboarding !== null && !onboarding.isComplete && !user?.onboarding_completed

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="glass-enhanced rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back,{' '}
          <span className="bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-transparent bg-clip-text">
            {user?.display_name ?? 'Creator'}
          </span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Here's what's happening with your content today.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-enhanced rounded-2xl p-6 flex items-center gap-4 border border-red-200 dark:border-red-800/30">
          <AlertCircleIcon size={24} className="text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button
            onClick={() => void loadDashboard()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
          >
            <RefreshCwIcon size={16} />
            Retry
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Posts Published"
          value={overview?.published_posts}
          icon={<TrendingUpIcon size={20} className="text-blue-600" />}
          color="bg-blue-100 dark:bg-blue-900/30"
          loading={loading}
        />
        <StatCard
          label="Posts Scheduled"
          value={overview?.scheduled_posts}
          icon={<CalendarIcon size={20} className="text-orange-500" />}
          color="bg-orange-100 dark:bg-orange-900/30"
          loading={loading}
        />
        <StatCard
          label="Credits Remaining"
          value={walletBalance ?? undefined}
          icon={<CreditCardIcon size={20} className="text-[#3FE0A5]" />}
          color="bg-emerald-100 dark:bg-emerald-900/30"
          loading={loading}
        />
        <StatCard
          label="Active Pipelines"
          value={overview?.active_pipelines}
          icon={<SparklesIcon size={20} className="text-purple-500" />}
          color="bg-purple-100 dark:bg-purple-900/30"
          loading={loading}
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/content"
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl shadow-lg shadow-[#3FE0A5]/20 hover:opacity-90 transition-opacity"
        >
          <SparklesIcon size={18} />
          Create Content
        </Link>
        <Link
          to="/calendar"
          className="flex items-center gap-2 px-5 py-2.5 glass-enhanced text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
        >
          <CalendarIcon size={18} />
          View Calendar
        </Link>
        <Link
          to="/credits/add"
          className="flex items-center gap-2 px-5 py-2.5 glass-enhanced text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
        >
          <CreditCardIcon size={18} />
          Add Credits
        </Link>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent posts — takes 2 cols */}
        <div className="lg:col-span-2">
          <RecentPosts posts={recentPosts} loading={loading} />
        </div>

        {/* Onboarding checklist or placeholder */}
        <div>
          {showOnboarding && onboarding ? (
            <OnboardingChecklist status={onboarding} />
          ) : (
            <div className="glass-enhanced rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Stats
              </h2>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Total Jobs Run', value: overview?.total_jobs ?? 0 },
                    { label: 'Credits Used', value: overview?.total_credits_used ?? 0 },
                    { label: 'Pipeline Runs', value: overview?.total_pipeline_runs ?? 0 },
                    {
                      label: 'Pipeline Success',
                      value: `${overview?.pipeline_success_rate ?? 0}%`,
                    },
                    {
                      label: 'Connected Accounts',
                      value: overview?.connected_accounts ?? 0,
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {stat.label}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

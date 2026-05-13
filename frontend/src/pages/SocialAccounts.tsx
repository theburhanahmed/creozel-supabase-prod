import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  InstagramIcon,
  YoutubeIcon,
  TwitterIcon,
  LinkedinIcon,
  FacebookIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  UsersIcon,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { getSocialConnections, disconnectSocialAccount, getOAuthUrl } from '../services/socialService'
import type { SocialConnection, SocialPlatform } from '../types'

const PLATFORMS: Array<{
  id: SocialPlatform
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  description: string
}> = [
  {
    id: 'instagram',
    label: 'Instagram',
    icon: <InstagramIcon size={22} />,
    color: '#E1306C',
    bgColor: 'from-pink-500 to-rose-500',
    description: 'Share photos, reels, and stories',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: <YoutubeIcon size={22} />,
    color: '#FF0000',
    bgColor: 'from-red-500 to-red-600',
    description: 'Upload videos and shorts',
  },
  {
    id: 'twitter',
    label: 'Twitter / X',
    icon: <TwitterIcon size={22} />,
    color: '#1DA1F2',
    bgColor: 'from-sky-400 to-sky-500',
    description: 'Post tweets and threads',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: <FacebookIcon size={22} />,
    color: '#1877F2',
    bgColor: 'from-blue-500 to-blue-600',
    description: 'Share posts and stories',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: <LinkedinIcon size={22} />,
    color: '#0A66C2',
    bgColor: 'from-blue-600 to-blue-700',
    description: 'Publish professional content',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: <span className="text-lg font-black">TT</span>,
    color: '#010101',
    bgColor: 'from-gray-800 to-gray-900',
    description: 'Create and share short videos',
  },
]

export const SocialAccounts: React.FC = () => {
  const { user, activeTeam } = useAppContext()
  const navigate = useNavigate()
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading]         = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  // Task 8.4: Clear connections immediately when activeTeam changes
  useEffect(() => {
    setConnections([])
  }, [activeTeam])

  const loadConnections = useCallback(async () => {
    if (!activeTeam) return
    setLoading(true)
    const data = await getSocialConnections(activeTeam.id)
    setConnections(data)
    setLoading(false)
  }, [activeTeam])

  useEffect(() => {
    if (!activeTeam) {
      setLoading(false)
      return
    }
    void loadConnections()
  }, [loadConnections, activeTeam])

  const handleConnect = (platform: SocialPlatform) => {
    if (!user || !activeTeam) return
    const url = getOAuthUrl(platform, user.id, activeTeam.id)
    window.location.href = url
  }

  const handleDisconnect = async (connection: SocialConnection) => {
    if (!activeTeam) return
    setDisconnecting(connection.id)
    const ok = await disconnectSocialAccount(connection.id, activeTeam.id)
    setDisconnecting(null)
    if (ok) {
      toast.success(`${connection.account_name} disconnected`)
      setConnections((prev) => prev.filter((c) => c.id !== connection.id))
    } else {
      toast.error('Failed to disconnect account')
    }
  }

  const connectedPlatforms = new Set(
    connections.filter((c) => c.is_active).map((c) => c.platform),
  )

  // Task 8.1: Null-team empty state — do not render connections list
  if (!activeTeam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
          <UsersIcon size={32} className="text-gray-400 dark:text-gray-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            A team is required to manage social accounts
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
            Create or join a team to connect your social platforms and start publishing.
          </p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          <UsersIcon size={16} />
          Create or Join a Team
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-enhanced rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {activeTeam.name} — Social Accounts
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Connect your social platforms to enable publishing
          </p>
        </div>
        <button
          onClick={() => void loadConnections()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors"
        >
          <RefreshCwIcon size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Connected accounts */}
      {connections.filter((c) => c.is_active).length > 0 && (
        <div className="glass-enhanced rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
            Connected Accounts
          </h2>
          <div className="space-y-3">
            {connections.filter((c) => c.is_active).map((conn) => {
              const platform = PLATFORMS.find((p) => p.id === conn.platform)
              return (
                <div
                  key={conn.id}
                  className="flex items-center gap-4 p-4 glass-light rounded-xl"
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform?.bgColor ?? 'from-gray-400 to-gray-500'} flex items-center justify-center text-white flex-shrink-0`}
                  >
                    {platform?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {conn.account_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {platform?.label} · Connected{' '}
                      {new Date(conn.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <CheckCircleIcon size={18} className="text-[#3FE0A5] flex-shrink-0" />
                  <button
                    onClick={() => void handleDisconnect(conn)}
                    disabled={disconnecting === conn.id}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    aria-label={`Disconnect ${conn.account_name}`}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Available platforms */}
      <div className="glass-enhanced rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          Available Platforms
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORMS.map((platform) => {
            const isConnected = connectedPlatforms.has(platform.id)
            return (
              <div
                key={platform.id}
                className="flex items-center gap-4 p-4 glass-light rounded-xl"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${platform.bgColor} flex items-center justify-center text-white flex-shrink-0`}
                >
                  {platform.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {platform.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {platform.description}
                  </p>
                </div>
                {isConnected ? (
                  <div className="flex items-center gap-1 text-xs text-[#3FE0A5] font-medium">
                    <CheckCircleIcon size={14} />
                    Connected
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    <PlusIcon size={12} />
                    Connect
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Info banner */}
      <div className="glass-enhanced rounded-2xl p-4 flex items-start gap-3 border border-blue-200/50 dark:border-blue-800/30">
        <AlertCircleIcon size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium text-gray-900 dark:text-white mb-1">
            OAuth connection required
          </p>
          <p>
            Connecting a platform will redirect you to that platform's authorization page.
            Your tokens are stored encrypted and never shared.{' '}
            <a href="/settings" className="text-[#3FE0A5] hover:underline inline-flex items-center gap-1">
              Learn more <ExternalLinkIcon size={12} />
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  UserIcon,
  BriefcaseIcon,
  ShieldIcon,
  BellIcon,
  LinkIcon,
  SaveIcon,
  Loader2Icon,
  CheckCircleIcon,
  AlertCircleIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import {
  getProfile,
  updateProfile,
  getBrandProfile,
  upsertBrandProfile,
  updatePassword,
  updateNotificationPreferences,
} from '../services/settingsService'
import { getSocialConnections } from '../services/socialService'
import { reportError } from '../utils/errorReporter'
import type { BrandProfile, NotificationPreferences, SocialConnection, SocialPlatform } from '../types'

type Tab = 'profile' | 'brand' | 'security' | 'notifications' | 'integrations'

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'profile',       label: 'Profile',       icon: <UserIcon size={16} /> },
  { id: 'brand',         label: 'Brand',         icon: <BriefcaseIcon size={16} /> },
  { id: 'security',      label: 'Security',      icon: <ShieldIcon size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <BellIcon size={16} /> },
  { id: 'integrations',  label: 'Integrations',  icon: <LinkIcon size={16} /> },
]

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
]

// ─── Profile Tab ──────────────────────────────────────────────────────────────
const ProfileTab: React.FC = () => {
  const { user, setUser } = useAppContext()
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [avatarUrl, setAvatarUrl]     = useState(user?.avatar_url ?? '')
  const [bio, setBio]                 = useState(user?.bio ?? '')
  const [phone, setPhone]             = useState(user?.phone ?? '')
  const [timezone, setTimezone]       = useState(user?.timezone ?? 'UTC')
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    if (!user) return
    void getProfile(user.id).then((profile) => {
      if (!profile) return
      setDisplayName((profile as { display_name?: string }).display_name ?? user.display_name ?? '')
      setAvatarUrl((profile as { avatar_url?: string }).avatar_url ?? user.avatar_url ?? '')
      setBio((profile as { bio?: string }).bio ?? '')
      setPhone((profile as { phone?: string }).phone ?? '')
      setTimezone((profile as { timezone?: string }).timezone ?? 'UTC')
    })
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const ok = await updateProfile(user.id, {
      display_name: displayName,
      avatar_url:   avatarUrl,
      bio,
      phone,
      timezone,
    })
    setSaving(false)
    if (ok) {
      setUser({ ...user, display_name: displayName, avatar_url: avatarUrl, bio, phone, timezone })
      toast.success('Profile updated')
    } else {
      toast.error('Failed to update profile')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 mb-6">
        <img
          src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'U')}&background=3FE0A5&color=fff`}
          alt={displayName}
          className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
        />
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{displayName || 'Your Name'}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Avatar URL
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="Tell us about yourself..."
          className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
        />
      </div>

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <Loader2Icon size={16} className="animate-spin" /> : <SaveIcon size={16} />}
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </div>
  )
}

// ─── Brand Tab ────────────────────────────────────────────────────────────────
const BrandTab: React.FC = () => {
  const { user } = useAppContext()
  const [brandName, setBrandName]           = useState('')
  const [logoUrl, setLogoUrl]               = useState('')
  const [voiceGuidelines, setVoiceGuidelines] = useState('')
  const [saving, setSaving]                 = useState(false)

  useEffect(() => {
    if (!user) return
    void getBrandProfile(user.id).then((bp: BrandProfile | null) => {
      if (!bp) return
      setBrandName(bp.brand_name ?? '')
      setLogoUrl(bp.logo_url ?? '')
      setVoiceGuidelines(bp.voice_guidelines ?? '')
    })
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const ok = await upsertBrandProfile(user.id, {
      brand_name:       brandName,
      logo_url:         logoUrl,
      voice_guidelines: voiceGuidelines,
    })
    setSaving(false)
    if (ok) toast.success('Brand profile saved')
    else toast.error('Failed to save brand profile')
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Brand settings are injected into AI generation prompts to keep your content on-brand.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Brand Name
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Acme Corp"
            className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Logo URL
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Voice Guidelines
        </label>
        <textarea
          value={voiceGuidelines}
          onChange={(e) => setVoiceGuidelines(e.target.value)}
          rows={5}
          placeholder="Describe your brand voice, tone, and style. E.g.: We are a friendly, professional SaaS company. We use simple language, avoid jargon, and always end with a clear call to action..."
          className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
        />
      </div>

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <Loader2Icon size={16} className="animate-spin" /> : <SaveIcon size={16} />}
        {saving ? 'Saving…' : 'Save Brand Profile'}
      </button>
    </div>
  )
}

// ─── Security Tab ─────────────────────────────────────────────────────────────
const SecurityTab: React.FC = () => {
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving]                   = useState(false)

  const handleSave = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSaving(true)
    const ok = await updatePassword(newPassword)
    setSaving(false)
    if (ok) {
      toast.success('Password updated')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      toast.error('Failed to update password')
    }
  }

  return (
    <div className="space-y-5 max-w-md">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Min. 8 characters"
          className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Confirm New Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat password"
          className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
        />
      </div>
      <button
        onClick={() => void handleSave()}
        disabled={saving || !newPassword}
        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <Loader2Icon size={16} className="animate-spin" /> : <ShieldIcon size={16} />}
        {saving ? 'Updating…' : 'Update Password'}
      </button>
    </div>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────
const NotificationsTab: React.FC = () => {
  const { user } = useAppContext()
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    email_on_post_failure: true,
    email_on_low_credits:  true,
    email_on_job_complete: false,
    in_app_all:            true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.notification_preferences) {
      setPrefs(user.notification_preferences)
    }
  }, [user])

  const toggle = (key: keyof NotificationPreferences) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const ok = await updateNotificationPreferences(user.id, prefs)
    setSaving(false)
    if (ok) toast.success('Notification preferences saved')
    else toast.error('Failed to save preferences')
  }

  const items: Array<{ key: keyof NotificationPreferences; label: string; description: string }> = [
    { key: 'in_app_all',            label: 'In-app notifications',       description: 'Show all notifications in the activity feed' },
    { key: 'email_on_post_failure', label: 'Email on post failure',      description: 'Get an email when a scheduled post fails to publish' },
    { key: 'email_on_low_credits',  label: 'Email on low credits',       description: 'Get an email when your credit balance is running low' },
    { key: 'email_on_job_complete', label: 'Email on job completion',    description: 'Get an email when AI generation completes' },
  ]

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between p-4 glass-light rounded-xl"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {item.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {item.description}
              </p>
            </div>
            <button
              onClick={() => toggle(item.key)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                prefs[item.key] ? 'bg-[#3FE0A5]' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={prefs[item.key] ?? false}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  prefs[item.key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <Loader2Icon size={16} className="animate-spin" /> : <SaveIcon size={16} />}
        {saving ? 'Saving…' : 'Save Preferences'}
      </button>
    </div>
  )
}

// ─── Integrations Tab ────────────────────────────────────────────────────────
const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  youtube:   'YouTube',
  twitter:   'Twitter / X',
  facebook:  'Facebook',
  linkedin:  'LinkedIn',
  tiktok:    'TikTok',
}

const IntegrationsTab: React.FC = () => {
  const { user } = useAppContext()
  const navigate = useNavigate()
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getSocialConnections(user.id)
      .then(setConnections)
      .catch((error: unknown) => {
        reportError('IntegrationsTab.load', error)
        toast.error('Failed to load connected accounts')
      })
      .finally(() => setLoading(false))
  }, [user])

  const connectedPlatforms = new Set(connections.filter((c) => c.is_active).map((c) => c.platform))
  const platforms: SocialPlatform[] = ['instagram', 'youtube', 'twitter', 'facebook', 'linkedin', 'tiktok']

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Manage your connected social accounts. Full connection management is available on the{' '}
        <button
          onClick={() => navigate('/social-accounts')}
          className="text-[#3FE0A5] hover:underline font-medium"
        >
          Social Accounts
        </button>{' '}
        page.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {platforms.map((platform) => {
            const isConnected = connectedPlatforms.has(platform)
            return (
              <div key={platform} className="flex items-center justify-between p-4 glass-light rounded-xl">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {PLATFORM_LABELS[platform]}
                </span>
                {isConnected ? (
                  <div className="flex items-center gap-1.5 text-[#3FE0A5] text-xs font-medium">
                    <CheckCircleIcon size={14} />
                    Connected
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <AlertCircleIcon size={14} />
                    Not connected
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={() => navigate('/social-accounts')}
        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
      >
        <RefreshCwIcon size={16} />
        Manage Connections
      </button>
    </div>
  )
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div className="space-y-6">
      <div className="glass-enhanced rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Manage your account, brand, and preferences
        </p>
      </div>

      <div className="glass-enhanced rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200/50 dark:border-gray-700/30 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-[#3FE0A5] text-[#3FE0A5]'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'profile'       && <ProfileTab />}
          {activeTab === 'brand'         && <BrandTab />}
          {activeTab === 'security'      && <SecurityTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'integrations'  && <IntegrationsTab />}
        </div>
      </div>
    </div>
  )
}

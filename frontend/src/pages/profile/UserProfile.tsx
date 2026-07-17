import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { SettingsIcon, CalendarIcon, SparklesIcon, SaveIcon, XIcon, Loader2Icon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { getProfile, updateProfile } from '../../services/settingsService'
import { reportError } from '../../utils/errorReporter'

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
]

export const UserProfile: React.FC = () => {
  const { user, setUser, creditsBalance } = useAppContext()

  // Profile fields
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [avatarUrl, setAvatarUrl]     = useState(user?.avatar_url ?? '')
  const [bio, setBio]                 = useState(user?.bio ?? '')
  const [phone, setPhone]             = useState(user?.phone ?? '')
  const [timezone, setTimezone]       = useState(user?.timezone ?? 'UTC')
  const credits = creditsBalance ?? 0

  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [snapshot, setSnapshot]   = useState({ displayName, avatarUrl, bio, phone, timezone })

  useEffect(() => {
    if (!user) return
    void getProfile(user.id).then((profile) => {
      if (!profile) return
      const p = profile as {
        display_name?: string; avatar_url?: string; bio?: string
        phone?: string; timezone?: string
      }
      setDisplayName(p.display_name ?? user.display_name ?? '')
      setAvatarUrl(p.avatar_url ?? user.avatar_url ?? '')
      setBio(p.bio ?? '')
      setPhone(p.phone ?? '')
      setTimezone(p.timezone ?? 'UTC')
    })
  }, [user])

  const handleEdit = () => {
    setSnapshot({ displayName, avatarUrl, bio, phone, timezone })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setDisplayName(snapshot.displayName)
    setAvatarUrl(snapshot.avatarUrl)
    setBio(snapshot.bio)
    setPhone(snapshot.phone)
    setTimezone(snapshot.timezone)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const ok = await updateProfile(user.id, {
        display_name: displayName,
        avatar_url:   avatarUrl,
        bio,
        phone,
        timezone,
      })
      if (ok) {
        setUser({ ...user, display_name: displayName, avatar_url: avatarUrl, bio, phone, timezone })
        toast.success('Profile updated')
        setIsEditing(false)
      } else {
        toast.error('Failed to update profile')
      }
    } catch (err: unknown) {
      reportError('UserProfile.handleSave', err)
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Profile card */}
      <div className="glass-enhanced rounded-2xl p-8">
        {isEditing ? (
          /* ── Edit form ── */
          <div className="space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Profile</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors"
                >
                  <XIcon size={15} />
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 text-sm"
                >
                  {saving ? <Loader2Icon size={15} className="animate-spin" /> : <SaveIcon size={15} />}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Avatar URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
                >
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us about yourself..."
                className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all"
              />
            </div>
          </div>
        ) : (
          /* ── Read-only view ── */
          <div className="flex items-start gap-6">
            <img
              src={
                avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'U')}&background=3FE0A5&color=fff&size=128`
              }
              alt={displayName}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-white/20 shadow-xl flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayName || 'Your Name'}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{user.email}</p>
              {bio && (
                <p className="text-gray-700 dark:text-gray-300 text-sm mt-3">{bio}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
                {phone && <span>📞 {phone}</span>}
                <span>🌍 {timezone}</span>
                <span className="text-[#3FE0A5] font-semibold">⚡ {credits} credits</span>
              </div>
            </div>
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors flex-shrink-0"
            >
              <SettingsIcon size={16} />
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Create Content', icon: <SparklesIcon size={20} />, href: '/content',  color: 'from-[#3FE0A5] to-[#38B897]' },
          { label: 'View Calendar',  icon: <CalendarIcon size={20} />, href: '/calendar', color: 'from-blue-500 to-indigo-500' },
          { label: 'Settings',       icon: <SettingsIcon size={20} />, href: '/settings', color: 'from-gray-500 to-gray-600' },
        ].map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${item.color} text-white font-semibold hover:opacity-90 transition-opacity`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SettingsIcon, CalendarIcon, SparklesIcon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { getProfile } from '../../services/settingsService'

export const UserProfile: React.FC = () => {
  const { user } = useAppContext()
  const [bio, setBio]         = useState<string>('')
  const [phone, setPhone]     = useState<string>('')
  const [timezone, setTimezone] = useState<string>('UTC')
  const [credits, setCredits] = useState<number>(0)

  useEffect(() => {
    if (!user) return
    void getProfile(user.id).then((profile) => {
      if (!profile) return
      setBio((profile as { bio?: string }).bio ?? '')
      setPhone((profile as { phone?: string }).phone ?? '')
      setTimezone((profile as { timezone?: string }).timezone ?? 'UTC')
      setCredits((profile as { credits?: number }).credits ?? 0)
    })
  }, [user])

  if (!user) return null

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Profile card */}
      <div className="glass-enhanced rounded-2xl p-8">
        <div className="flex items-start gap-6">
          <img
            src={
              user.avatar_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name ?? 'U')}&background=3FE0A5&color=fff&size=128`
            }
            alt={user.display_name}
            className="w-24 h-24 rounded-2xl object-cover border-2 border-white/20 shadow-xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.display_name || 'Your Name'}
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
          <Link
            to="/settings"
            className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors flex-shrink-0"
          >
            <SettingsIcon size={16} />
            Edit Profile
          </Link>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Create Content', icon: <SparklesIcon size={20} />, href: '/content', color: 'from-[#3FE0A5] to-[#38B897]' },
          { label: 'View Calendar', icon: <CalendarIcon size={20} />, href: '/calendar', color: 'from-blue-500 to-indigo-500' },
          { label: 'Settings',      icon: <SettingsIcon size={20} />, href: '/settings', color: 'from-gray-500 to-gray-600' },
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

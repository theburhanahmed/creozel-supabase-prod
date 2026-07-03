import React, { useEffect, useState } from 'react'
import { CheckIcon, BellOffIcon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { getNotifications, markAsRead, markAllAsRead, subscribeToNotifications } from '../../services/notificationService'
import type { Notification } from '../../types'

const TYPE_ICONS: Record<string, string> = {
  job_complete:    '✅',
  job_failed:      '❌',
  post_published:  '📢',
  post_failed:     '⚠️',
  pipeline_done:   '🔄',
  low_credits:     '💳',
  team_invite:     '👥',
  default:         '🔔',
}

export const Notifications: React.FC = () => {
  const { user } = useAppContext()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void getNotifications(user.id).then((data) => { setNotifications(data); setLoading(false) })
    const unsub = subscribeToNotifications(user.id, (n) => setNotifications((prev) => [n, ...prev]))
    return unsub
  }, [user])

  const handleMarkRead = async (id: string) => {
    await markAsRead(id)
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    await markAllAsRead(user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="glass-enhanced rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Notifications</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => void handleMarkAllRead()} className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors">
            <CheckIcon size={16} />
            Mark all read
          </button>
        )}
      </div>

      <div className="glass-enhanced rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-[#3FE0A5]/30 border-t-[#3FE0A5] rounded-full animate-spin mx-auto" /></div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <BellOffIcon size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200/50 dark:divide-gray-700/30">
            {notifications.map((n) => (
              <div key={n.id} className={`flex items-start gap-4 p-4 transition-colors ${n.is_read ? '' : 'bg-[#3FE0A5]/5'}`}>
                <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? TYPE_ICONS.default}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${n.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.is_read && (
                  <button onClick={() => void handleMarkRead(n.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0" aria-label="Mark as read">
                    <CheckIcon size={14} className="text-[#3FE0A5]" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

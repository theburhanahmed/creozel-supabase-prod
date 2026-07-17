import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserIcon, SettingsIcon, LogOutIcon, ExternalLinkIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppContext } from '../../context/AppContext'
import { authService } from '../../services/authService'
import { toast } from 'sonner'

// ─── Base Dropdown ────────────────────────────────────────────────────────────
const Dropdown: React.FC<{
  show: boolean
  onClose: () => void
  children: React.ReactNode
}> = ({ show, onClose, children }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [show, onClose])

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[45]"
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.18, ease: [0.165, 0.84, 0.44, 1] }}
            className="absolute top-full right-0 mt-2 w-72 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 z-50"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Profile Menu ─────────────────────────────────────────────────────────────
export const ProfileMenu: React.FC = () => {
  const { showProfileMenu, toggleProfileMenu, user, setUser } = useAppContext()
  const navigate = useNavigate()

  const handleLogout = async () => {
    toggleProfileMenu()
    try {
      await authService.logout()
      setUser(null)
      toast.success('Signed out')
      navigate('/auth/login', { replace: true })
    } catch {
      toast.error('Sign out failed')
    }
  }

  return (
    <Dropdown show={showProfileMenu} onClose={toggleProfileMenu}>
      <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
        <img
          src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.display_name ?? 'U')}&background=3FE0A5&color=fff`}
          alt={user?.display_name ?? 'User'}
          className="w-12 h-12 rounded-xl object-cover border-2 border-white/10 shadow-md"
        />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{user?.display_name ?? 'User'}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
        </div>
      </div>
      <div className="py-2">
        <Link to="/profile" onClick={toggleProfileMenu} className="flex items-center gap-3 px-5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-gray-800/50 transition-colors">
          <UserIcon size={16} className="text-gray-400" /> Your Profile
        </Link>
        <Link to="/settings" onClick={toggleProfileMenu} className="flex items-center gap-3 px-5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-gray-800/50 transition-colors">
          <SettingsIcon size={16} className="text-gray-400" /> Settings
        </Link>
        <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-5 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100/70 dark:hover:bg-gray-800/50 transition-colors">
          <LogOutIcon size={16} /> Sign Out
        </button>
      </div>
    </Dropdown>
  )
}

// ─── Notifications Menu ───────────────────────────────────────────────────────
export const NotificationsMenu: React.FC = () => {
  const { showNotifications, toggleNotifications } = useAppContext()
  const navigate = useNavigate()

  const notifications = [
    { id: 1, title: 'New follower', message: 'Someone started following your account', time: '2h ago', read: false },
    { id: 2, title: 'Content published', message: 'Your post is now live', time: '5h ago', read: false },
    { id: 3, title: 'Reminder', message: 'Scheduled post in 30 minutes', time: 'Yesterday', read: true },
  ]

  return (
    <Dropdown show={showNotifications} onClose={toggleNotifications}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
        <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-medium">
          {notifications.filter((n) => !n.read).length}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {notifications.map((n) => (
          <div key={n.id} className={`p-4 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!n.read ? 'bg-[#3FE0A5]/5' : ''}`}>
            <div className="flex justify-between mb-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
              <span className="text-xs text-gray-400">{n.time}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{n.message}</p>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => { toggleNotifications(); navigate('/notifications') }}
          className="flex items-center justify-center gap-1.5 w-full text-sm text-[#3FE0A5] hover:text-[#38B897] font-medium py-1 transition-colors"
        >
          View all <ExternalLinkIcon size={13} />
        </button>
      </div>
    </Dropdown>
  )
}

// ─── Mailbox Menu ─────────────────────────────────────────────────────────────
export const MailboxMenu: React.FC = () => {
  const { showMailbox, toggleMailbox } = useAppContext()
  const navigate = useNavigate()

  const messages = [
    { id: 1, sender: 'Sarah Johnson', avatar: 'https://i.pravatar.cc/40?img=1', message: 'Can you send the design files?', time: '10:42 AM', read: false },
    { id: 2, sender: 'Alex Wong', avatar: 'https://i.pravatar.cc/40?img=2', message: 'Great job on the presentation!', time: '9:30 AM', read: true },
  ]

  return (
    <Dropdown show={showMailbox} onClose={toggleMailbox}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Messages</h3>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className={`p-4 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!m.read ? 'bg-[#3FE0A5]/5' : ''}`}>
            <div className="flex gap-3">
              <img src={m.avatar} alt={m.sender} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              <div className="min-w-0">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.sender}</p>
                  <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">{m.time}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => { toggleMailbox(); navigate('/messages') }}
          className="flex items-center justify-center gap-1.5 w-full text-sm text-[#3FE0A5] hover:text-[#38B897] font-medium py-1 transition-colors"
        >
          View all messages <ExternalLinkIcon size={13} />
        </button>
      </div>
    </Dropdown>
  )
}

// ─── Credits Menu ─────────────────────────────────────────────────────────────
export const CreditsMenu: React.FC = () => {
  const { showCreditsMenu, toggleCreditsMenu, creditsBalance } = useAppContext()
  const navigate = useNavigate()

  return (
    <Dropdown show={showCreditsMenu} onClose={toggleCreditsMenu}>
      <div className="p-5 border-b border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Balance</p>
        <p className="text-4xl font-bold text-[#3FE0A5]">{creditsBalance ?? 0}</p>
        <p className="text-xs text-gray-400 mt-1">Credits</p>
      </div>
      <div className="p-4 space-y-2">
        <button
          onClick={() => { toggleCreditsMenu(); navigate('/credits/add') }}
          className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#3FE0A5] to-[#38B897] rounded-xl hover:brightness-105 transition-all"
        >
          Buy More Credits
        </button>
        <button
          onClick={() => { toggleCreditsMenu(); navigate('/credits/transactions') }}
          className="w-full py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
        >
          View Transactions
        </button>
      </div>
    </Dropdown>
  )
}

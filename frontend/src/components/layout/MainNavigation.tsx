import React, { useEffect, useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HomeIcon, BarChart2Icon, CalendarIcon, MessageSquareIcon, UsersIcon,
  PenToolIcon, RocketIcon, GlobeIcon, FolderIcon, FileTextIcon, ImageIcon,
  VideoIcon, MicIcon, SettingsIcon, HelpCircleIcon, BellIcon, MailIcon,
  MenuIcon, XIcon, ChevronDownIcon, DollarSignIcon, SparklesIcon, SunIcon,
  MoonIcon, ChevronRightIcon, LayoutDashboardIcon, TrendingUpIcon, SendIcon,
  WorkflowIcon, TargetIcon, TestTubeIcon, CreditCardIcon, HistoryIcon,
  ReceiptIcon, HeadphonesIcon, SearchIcon,
} from 'lucide-react'
import { FocusTrap } from '../ui/AccessibilityUtils'
import { cn } from '../../lib/utils'
import { useAppContext } from '../../context/AppContext'
import { ProfileMenu, NotificationsMenu, MailboxMenu, CreditsMenu } from '../ui/DropdownMenus'

interface NavItem { icon: React.ReactNode; title: string; href: string; children?: NavItem[]; description?: string }

export const MainNavigation: React.FC<{ onOpenCommandPalette?: () => void }> = ({ onOpenCommandPalette }) => {
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const sidebarRef = useRef<HTMLDivElement>(null)
  const {
    isDarkMode, toggleDarkMode,
    toggleProfileMenu, toggleNotifications, toggleMailbox, toggleCreditsMenu,
    showProfileMenu, showNotifications, showMailbox, showCreditsMenu, user,
  } = useAppContext()

  useEffect(() => { setIsSidebarOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!isSidebarOpen) return
    const handler = (e: MouseEvent) => { if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) setIsSidebarOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsSidebarOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc) }
  }, [isSidebarOpen])

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  const hasActiveChild = (children?: NavItem[]) => children?.some((c) => isActive(c.href)) ?? false
  const toggleExpanded = (title: string) => setExpandedItems((p) => p.includes(title) ? p.filter((i) => i !== title) : [...p, title])

  const navItems: NavItem[] = [
    { icon: <HomeIcon size={18} />, title: 'Home', href: '/' },
    {
      icon: <SparklesIcon size={18} />, title: 'Create', href: '/content',
      children: [
        { icon: <FileTextIcon size={16} />, title: 'Text Editor', href: '/content/text', description: 'Generate text content' },
        { icon: <ImageIcon size={16} />, title: 'Image Editor', href: '/content/image', description: 'Create images' },
        { icon: <VideoIcon size={16} />, title: 'Video Editor', href: '/content/video', description: 'Generate videos' },
        { icon: <HeadphonesIcon size={16} />, title: 'Audio Editor', href: '/content/audio', description: 'Create audio' },
        { icon: <FolderIcon size={16} />, title: 'Content Library', href: '/content/library', description: 'All generated content' },
      ],
    },
    {
      icon: <RocketIcon size={18} />, title: 'Autopilot', href: '/autopilot',
      children: [
        { icon: <LayoutDashboardIcon size={16} />, title: 'Dashboard', href: '/autopilot', description: 'Automation overview' },
        { icon: <PenToolIcon size={16} />, title: 'Create Pipeline', href: '/autopilot/create', description: 'New automation' },
        { icon: <CalendarIcon size={16} />, title: 'Scheduler', href: '/autopilot/scheduler', description: 'Schedule posts' },
        { icon: <FolderIcon size={16} />, title: 'Media Library', href: '/autopilot/media', description: 'Manage assets' },
      ],
    },
    {
      icon: <BarChart2Icon size={18} />, title: 'Analytics', href: '/analytics',
      children: [
        { icon: <LayoutDashboardIcon size={16} />, title: 'Overview', href: '/analytics', description: 'Analytics dashboard' },
        { icon: <TrendingUpIcon size={16} />, title: 'Performance', href: '/analytics/performance', description: 'Content metrics' },
        { icon: <TestTubeIcon size={16} />, title: 'A/B Testing', href: '/analytics/ab-testing', description: 'Test variations' },
        { icon: <TargetIcon size={16} />, title: 'Audience', href: '/analytics/audience', description: 'Audience insights' },
      ],
    },
    {
      icon: <SendIcon size={18} />, title: 'Publishing', href: '/calendar',
      children: [
        { icon: <CalendarIcon size={16} />, title: 'Calendar', href: '/calendar', description: 'Content schedule' },
        { icon: <GlobeIcon size={16} />, title: 'Social Accounts', href: '/social-accounts', description: 'Connected platforms' },
        { icon: <FolderIcon size={16} />, title: 'Media Gallery', href: '/media', description: 'Published media' },
      ],
    },
    {
      icon: <MessageSquareIcon size={18} />, title: 'Communication', href: '/messages',
      children: [
        { icon: <MessageSquareIcon size={16} />, title: 'Messages', href: '/messages', description: 'Direct messages' },
        { icon: <UsersIcon size={16} />, title: 'Team', href: '/team', description: 'Team members' },
      ],
    },
    { icon: <WorkflowIcon size={18} />, title: 'Workflows', href: '/workflow' },
  ]

  const utilityItems: NavItem[] = [
    {
      icon: <CreditCardIcon size={18} />, title: 'Credits', href: '/credits/usage',
      children: [
        { icon: <HistoryIcon size={16} />, title: 'Usage History', href: '/credits/usage', description: 'View usage' },
        { icon: <CreditCardIcon size={16} />, title: 'Add Credits', href: '/credits/add', description: 'Purchase credits' },
        { icon: <ReceiptIcon size={16} />, title: 'Transactions', href: '/credits/transactions', description: 'Payment history' },
      ],
    },
    { icon: <DollarSignIcon size={18} />, title: 'Affiliate', href: '/affiliate' },
    { icon: <SettingsIcon size={18} />, title: 'Settings', href: '/settings' },
    { icon: <HelpCircleIcon size={18} />, title: 'Help', href: '/help' },
  ]

  const renderNavItem = (item: NavItem, index: number) => {
    if (item.children) {
      const active = hasActiveChild(item.children)
      const expanded = expandedItems.includes(item.title)
      return (
        <motion.div key={item.href} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * index, duration: 0.25 }}>
          <button
            onClick={() => toggleExpanded(item.title)}
            className={cn('flex items-center justify-between w-full px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200',
              active ? 'text-white bg-gradient-to-r from-[#3FE0A5] to-[#38B897] shadow-ios-sm' : 'text-gray-700 dark:text-gray-300 glass-light hover:glass hover:shadow-ios-sm backdrop-blur-ios')}
            aria-expanded={expanded}
          >
            <div className="flex items-center gap-3"><span>{item.icon}</span>{item.title}</div>
            <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}><ChevronRightIcon size={16} /></motion.div>
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="mt-1 ml-10 pl-3 border-l-2 border-[#3FE0A5]/30 space-y-1">
                  {item.children.map((child, ci) => (
                    <motion.div key={child.href} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ci * 0.03 }}>
                      <Link to={child.href} onClick={() => setIsSidebarOpen(false)}
                        className={cn('flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group',
                          isActive(child.href) ? 'text-[#3FE0A5] bg-[#3FE0A5]/10 font-semibold' : 'text-gray-700 dark:text-gray-300 glass-light hover:glass hover:shadow-ios-sm backdrop-blur-ios')}
                      >
                        <span className="opacity-80 group-hover:opacity-100 mt-0.5">{child.icon}</span>
                        <div>
                          <div className="font-medium group-hover:text-[#3FE0A5] transition-colors">{child.title}</div>
                          {child.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{child.description}</p>}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )
    }
    return (
      <motion.div key={item.href} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * index, duration: 0.25 }} whileHover={{ x: 2 }}>
        <Link to={item.href} onClick={() => setIsSidebarOpen(false)}
          className={cn('flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200',
            isActive(item.href) ? 'text-white bg-gradient-to-r from-[#3FE0A5] to-[#38B897] shadow-ios-sm' : 'text-gray-700 dark:text-gray-300 glass-light hover:glass hover:shadow-ios-sm backdrop-blur-ios')}
        >
          <span>{item.icon}</span>{item.title}
        </Link>
      </motion.div>
    )
  }

  return (
    <>
      {/* ── Top Header ── */}
      <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="fixed top-0 left-0 right-0 z-[var(--z-header)]" role="banner"
      >
        <div className="ios-card glass-light rounded-none border-b border-white/10 dark:border-gray-700/20 shadow-ios-lg backdrop-blur-ios">
          <div className="px-4 md:px-6 py-3 flex items-center justify-between max-w-screen-2xl mx-auto gap-4">
            {/* Left */}
            <div className="flex items-center gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="touch-target w-10 h-10 rounded-xl flex items-center justify-center glass-light hover:glass transition-all duration-200 group shadow-ios-sm"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-expanded={isSidebarOpen} aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'} aria-controls="main-navigation"
              >
                <MenuIcon size={20} className="text-gray-700 dark:text-gray-300 group-hover:text-[#3FE0A5] transition-colors" />
              </motion.button>
              <Link to="/" className="flex items-center group" aria-label="Creozel home">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white font-bold text-lg shadow-ios-md neon-green"
                >C</motion.div>
                <motion.span className="ml-3 text-lg font-bold bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-transparent bg-clip-text">
                  Creozel
                </motion.span>
              </Link>
            </div>

            {/* Center (desktop) */}
            <div className="hidden lg:flex items-center gap-4 flex-1 justify-center max-w-2xl">
              <Link to="/autopilot" className="flex items-center gap-2 px-4 py-2 rounded-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity" />
                <RocketIcon size={18} className="text-white relative z-10" />
                <span className="text-sm font-medium text-white relative z-10">Autopilot</span>
              </Link>
              {onOpenCommandPalette && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onOpenCommandPalette}
                  className="hidden xl:flex items-center gap-2 px-3 py-2 glass rounded-xl hover:shadow-ios-sm transition-all border border-white/5 dark:border-gray-700/20 backdrop-blur-ios"
                  aria-label="Open command palette"
                >
                  <SearchIcon size={16} className="text-gray-500 dark:text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Search...</span>
                  <kbd className="hidden 2xl:flex px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">⌘K</kbd>
                </motion.button>
              )}
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              {/* Credits */}
              <div className="relative">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="touch-target flex items-center gap-2 px-3 py-2 glass rounded-xl hover:shadow-ios-sm transition-all border border-white/5 dark:border-gray-700/20 backdrop-blur-ios"
                  onClick={toggleCreditsMenu} aria-expanded={showCreditsMenu} data-menu-toggle="credits"
                >
                  <span className="text-xs font-semibold text-[#3FE0A5]">Credits:</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{user?.credits ?? 0}</span>
                </motion.button>
                <CreditsMenu />
              </div>

              {/* Notifications */}
              <div className="relative">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  className="touch-target relative w-10 h-10 rounded-xl flex items-center justify-center glass-light hover:glass transition-all group shadow-ios-sm backdrop-blur-ios"
                  onClick={toggleNotifications} aria-expanded={showNotifications} data-menu-toggle="notifications"
                >
                  <BellIcon size={20} className="text-gray-700 dark:text-gray-300 group-hover:text-[#3FE0A5] transition-colors" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
                </motion.button>
                <NotificationsMenu />
              </div>

              {/* Messages */}
              <div className="relative">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  className="touch-target relative w-10 h-10 rounded-xl flex items-center justify-center glass-light hover:glass transition-all group shadow-ios-sm backdrop-blur-ios"
                  onClick={toggleMailbox} aria-expanded={showMailbox} data-menu-toggle="mailbox"
                >
                  <MailIcon size={20} className="text-gray-700 dark:text-gray-300 group-hover:text-[#3FE0A5] transition-colors" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
                </motion.button>
                <MailboxMenu />
              </div>

              {/* Theme toggle */}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={toggleDarkMode}
                className="touch-target w-10 h-10 rounded-xl flex items-center justify-center glass-light hover:glass transition-all overflow-hidden group shadow-ios-sm backdrop-blur-ios"
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <AnimatePresence mode="wait">
                  {isDarkMode
                    ? <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}><SunIcon size={20} className="text-amber-500" /></motion.div>
                    : <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}><MoonIcon size={20} className="text-gray-700" /></motion.div>
                  }
                </AnimatePresence>
              </motion.button>

              {/* Avatar */}
              <div className="relative">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  className="touch-target w-10 h-10 rounded-xl overflow-hidden border-2 border-white/20 dark:border-gray-700/30 hover:border-[#3FE0A5]/60 transition-all shadow-ios-sm"
                  onClick={toggleProfileMenu} aria-expanded={showProfileMenu} data-menu-toggle="profile"
                >
                  <img
                    src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.display_name ?? 'U')}&background=3FE0A5&color=fff`}
                    alt={user?.display_name ?? 'User'}
                    className="w-full h-full object-cover"
                  />
                </motion.button>
                <ProfileMenu />
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Sidebar ── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-overlay)]" onClick={() => setIsSidebarOpen(false)} />
            <FocusTrap isActive={isSidebarOpen} onEscape={() => setIsSidebarOpen(false)}>
              <motion.nav id="main-navigation" ref={sidebarRef}
                initial={{ x: '-100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '-100%', opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.165, 0.84, 0.44, 1] }}
                className="fixed top-0 left-0 bottom-0 z-[var(--z-sidebar)] w-full sm:w-80 ios-card glass border-r border-white/20 dark:border-gray-700/30 shadow-ios-2xl backdrop-blur-ios overflow-hidden flex flex-col"
                role="navigation" aria-label="Main navigation"
              >
                {/* Sidebar header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 dark:border-gray-700/30 glass-light backdrop-blur-ios flex-shrink-0">
                  <Link to="/" className="flex items-center" onClick={() => setIsSidebarOpen(false)}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white font-bold text-lg shadow-ios-md neon-green">C</div>
                    <span className="ml-3 text-lg font-bold bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-transparent bg-clip-text">Creozel</span>
                  </Link>
                  <motion.button whileHover={{ scale: 1.05, rotate: 90 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setIsSidebarOpen(false)}
                    className="touch-target p-2 rounded-xl glass-light hover:glass transition-all group shadow-ios-sm"
                    aria-label="Close menu"
                  >
                    <XIcon size={20} className="text-gray-700 dark:text-gray-300 group-hover:text-red-500 transition-colors" />
                  </motion.button>
                </div>

                {/* Sidebar content */}
                <div className="flex-1 overflow-y-auto ios-scroll p-4 space-y-6">
                  {/* Main nav */}
                  <div className="space-y-1">
                    <h3 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 font-bold px-1">Navigation</h3>
                    {navItems.map((item, i) => renderNavItem(item, i))}
                  </div>

                  {/* Utility nav */}
                  <div className="pt-4 border-t border-white/10 dark:border-gray-700/30 space-y-1">
                    <h3 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 font-bold px-1">Workspace</h3>
                    {utilityItems.map((item, i) => renderNavItem(item, i))}
                  </div>

                  {/* User card */}
                  <div className="pt-4 border-t border-white/10 dark:border-gray-700/30">
                    <div className="flex items-center p-3 glass rounded-xl border border-white/5 dark:border-gray-700/20 shadow-ios-sm backdrop-blur-ios">
                      <img
                        src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.display_name ?? 'U')}&background=3FE0A5&color=fff`}
                        alt={user?.display_name ?? 'User'}
                        className="w-12 h-12 rounded-xl object-cover border-2 border-white/20 shadow-ios-sm"
                      />
                      <div className="ml-3 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.display_name ?? 'User'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.nav>
            </FocusTrap>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

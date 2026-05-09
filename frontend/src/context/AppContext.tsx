import React, {
  useCallback,
  useEffect,
  useState,
  createContext,
  useContext,
} from 'react'
import { authService } from '../services/authService'
import type { User } from '../types'

interface AppContextType {
  // Theme
  isDarkMode: boolean
  toggleDarkMode: () => void
  // User data — sourced from live Supabase session
  user: User | null
  setUser: (user: User | null) => void
  isAuthLoading: boolean
  // UI states
  showProfileMenu: boolean
  showNotifications: boolean
  showMailbox: boolean
  showCreditsMenu: boolean
  toggleProfileMenu: () => void
  toggleNotifications: () => void
  toggleMailbox: () => void
  toggleCreditsMenu: () => void
  closeAllMenus: () => void
  setShowCreditsMenu: (show: boolean) => void
  setShowProfileMenu: (show: boolean) => void
  setShowNotifications: (show: boolean) => void
  setShowMailbox: (show: boolean) => void
  // Loading states
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  // Content creation modal
  showContentCreationModal: boolean
  toggleContentCreationModal: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMailbox, setShowMailbox] = useState(false)
  const [showCreditsMenu, setShowCreditsMenu] = useState(false)
  const [showContentCreationModal, setShowContentCreationModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    const prefersDark =
      saved !== null
        ? saved === 'true'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDarkMode(prefersDark)
    document.documentElement.classList.toggle('dark', prefersDark)
  }, [])

  // Subscribe to Supabase auth state — this is the single source of truth
  useEffect(() => {
    // Initial session check
    void authService.getCurrentUser().then((u) => {
      setUser(u)
      setIsAuthLoading(false)
    })

    // Listen for login / logout / token refresh events
    const { unsubscribe } = authService.onAuthStateChange((u) => {
      setUser(u)
      setIsAuthLoading(false)
    })

    return unsubscribe
  }, [])

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('darkMode', String(next))
      return next
    })
  }, [])

  const toggleProfileMenu = useCallback(() => {
    setShowProfileMenu((p) => !p)
    setShowNotifications(false)
    setShowMailbox(false)
    setShowCreditsMenu(false)
  }, [])

  const toggleNotifications = useCallback(() => {
    setShowNotifications((p) => !p)
    setShowProfileMenu(false)
    setShowMailbox(false)
    setShowCreditsMenu(false)
  }, [])

  const toggleMailbox = useCallback(() => {
    setShowMailbox((p) => !p)
    setShowProfileMenu(false)
    setShowNotifications(false)
    setShowCreditsMenu(false)
  }, [])

  const toggleCreditsMenu = useCallback(() => {
    setShowCreditsMenu((p) => !p)
    setShowProfileMenu(false)
    setShowNotifications(false)
    setShowMailbox(false)
  }, [])

  const closeAllMenus = useCallback(() => {
    setShowProfileMenu(false)
    setShowNotifications(false)
    setShowMailbox(false)
    setShowCreditsMenu(false)
  }, [])

  const toggleContentCreationModal = useCallback(() => {
    setShowContentCreationModal((p) => !p)
  }, [])

  // Close menus on outside click
  useEffect(() => {
    if (!showProfileMenu && !showNotifications && !showMailbox && !showCreditsMenu)
      return
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-menu-toggle]')) return
      closeAllMenus()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showProfileMenu, showNotifications, showMailbox, showCreditsMenu, closeAllMenus])

  return (
    <AppContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        user,
        setUser,
        isAuthLoading,
        showProfileMenu,
        showNotifications,
        showMailbox,
        showCreditsMenu,
        toggleProfileMenu,
        toggleNotifications,
        toggleMailbox,
        toggleCreditsMenu,
        closeAllMenus,
        setShowCreditsMenu,
        setShowProfileMenu,
        setShowNotifications,
        setShowMailbox,
        isLoading,
        setIsLoading,
        showContentCreationModal,
        toggleContentCreationModal,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = (): AppContextType => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

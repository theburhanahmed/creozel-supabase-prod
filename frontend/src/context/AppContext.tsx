import React, {
  useCallback,
  useEffect,
  useState,
  createContext,
  useContext,
} from 'react'
import { authService } from '../services/authService'
import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { User, Team, TeamRole } from '../types'

// Disable fast-refresh warning for context and helpers exported alongside the component.
/* eslint-disable react-refresh/only-export-components */

// ─── Team selection helpers ───────────────────────────────────────────────────

const ROLE_PRIORITY: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
}

export interface TeamMemberWithTeam {
  team_id: string
  role: TeamRole
  created_at: string
  teams: Team
}

/**
 * Pure function — selects the best team from a list of memberships.
 *
 * Selection order:
 *   1. Highest role priority (owner > admin > editor > viewer)
 *   2. Earliest `created_at` as tiebreaker
 *
 * Returns `null` when the list is empty.
 */
export function selectActiveTeam(
  members: TeamMemberWithTeam[],
): Team | null {
  if (members.length === 0) return null

  const sorted = [...members].sort((a, b) => {
    const priorityDiff = ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role]
    if (priorityDiff !== 0) return priorityDiff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return sorted[0].teams
}

interface AppContextType {
  // Theme
  isDarkMode: boolean
  toggleDarkMode: () => void
  // User data — sourced from live Supabase session
  user: User | null
  setUser: (user: User | null) => void
  isAuthLoading: boolean
  // Team / tenant state
  activeTeam: Team | null
  teams: Team[]
  setTeams: (teams: Team[]) => void
  isTeamLoading: boolean
  isStaleDataError: boolean
  setActiveTeam: (team: Team | null) => void
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
  const [activeTeam, setActiveTeamState] = useState<Team | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [isTeamLoading, setIsTeamLoading] = useState(true)
  const [isStaleDataError, setIsStaleDataError] = useState(false)
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

  // ─── Team loading helper ─────────────────────────────────────────────────────

  const loadTeamsForUser = useCallback(async (userId: string) => {
    try {
      const supabaseQuery = supabase
        .from('team_members')
        .select('*, teams(*)')
        .eq('user_id', userId)

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Team data fetch timed out after 10 seconds')),
          10000,
        ),
      )

      const { data, error } = await Promise.race([supabaseQuery, timeoutPromise])

      if (error) throw error

      const members = (data ?? []) as TeamMemberWithTeam[]
      const resolvedTeams = members.map((m) => m.teams)
      setTeams(resolvedTeams)

      // Read persisted active team id — guard against SecurityError in restricted contexts
      let storedId: string | null = null
      try {
        storedId = localStorage.getItem('creozel:activeTeamId')
      } catch {
        // SecurityError or similar — silently fall back to in-memory selection
      }

      if (storedId) {
        const match = members.find((m) => m.teams.id === storedId)
        if (match) {
          setActiveTeamState(match.teams)
          setIsTeamLoading(false)
          return
        }
      }

      // No stored match — apply role-priority selection
      setActiveTeamState(selectActiveTeam(members))
    } catch (error: unknown) {
      reportError('fetchTeamData [AppContext.tsx]', error)
      // If the error is a timeout, set the stale data error flag and ensure
      // no previous tenant's data is visible
      if (
        error instanceof Error &&
        error.message === 'Team data fetch timed out after 10 seconds'
      ) {
        setIsStaleDataError(true)
        setTeams([])
        setActiveTeamState(null)
      }
      // Leave teams as [] and activeTeam as null — UI will show error state
    } finally {
      setIsTeamLoading(false)
    }
  }, [])

  // Subscribe to Supabase auth state — this is the single source of truth
  useEffect(() => {
    // Initial session check
    void authService.getCurrentUser().then((u) => {
      setUser(u)
      setIsAuthLoading(false)
      if (u) {
        void loadTeamsForUser(u.id)
      } else {
        setIsTeamLoading(false)
      }
    })

    // Listen for login / logout / token refresh events
    const { unsubscribe } = authService.onAuthStateChange((u) => {
      setUser(u)
      setIsAuthLoading(false)
      if (u) {
        void loadTeamsForUser(u.id)
      } else {
        // User logged out — clear team state
        setTeams([])
        setActiveTeamState(null)
        setIsTeamLoading(false)
        try {
          localStorage.removeItem('creozel:activeTeamId')
        } catch (error: unknown) {
          reportError('setActiveTeam [AppContext.tsx]', error)
        }
      }
    })

    return unsubscribe
  }, [loadTeamsForUser])

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

  const setActiveTeam = useCallback((team: Team | null) => {
    // 1. Update in-memory state immediately
    setActiveTeamState(team)

    // 2. Persist to localStorage (wrapped in try/catch for SecurityError)
    if (team !== null) {
      try {
        localStorage.setItem('creozel:activeTeamId', team.id)
      } catch (error: unknown) {
        reportError('setActiveTeam [AppContext.tsx]', error)
      }
    } else {
      try {
        localStorage.removeItem('creozel:activeTeamId')
      } catch (error: unknown) {
        reportError('setActiveTeam [AppContext.tsx]', error)
      }
    }
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
        activeTeam,
        teams,
        setTeams,
        isTeamLoading,
        isStaleDataError,
        setActiveTeam,
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

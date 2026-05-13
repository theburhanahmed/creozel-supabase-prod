import React, { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, UsersIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Team } from '../../types/index'

interface TenantSwitcherProps {
  teams: Team[]
  activeTeam: Team | null
  onSwitch: (team: Team) => void
}

export const TenantSwitcher: React.FC<TenantSwitcherProps> = ({
  teams,
  activeTeam,
  onSwitch,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [isOpen])

  const handleSwitch = (team: Team) => {
    onSwitch(team)
    setIsOpen(false)
  }

  // Avatar fallback: first letter of team name
  const teamInitial = (name: string) => name.charAt(0).toUpperCase()

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={activeTeam ? `Active team: ${activeTeam.name}` : 'Personal Workspace'}
        className="flex items-center w-full p-3 glass rounded-xl border border-white/5 dark:border-gray-700/20 shadow-ios-sm backdrop-blur-ios hover:glass transition-all duration-200 gap-3"
      >
        {activeTeam ? (
          <>
            {/* Team avatar */}
            {activeTeam.logo_url ? (
              <img
                src={activeTeam.logo_url}
                alt={activeTeam.name}
                className="w-9 h-9 rounded-xl object-cover border-2 border-white/20 shadow-ios-sm flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white font-bold text-sm shadow-ios-sm flex-shrink-0">
                {teamInitial(activeTeam.name)}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {activeTeam.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Team workspace</p>
            </div>
          </>
        ) : (
          <>
            {/* Personal workspace display */}
            <div className="w-9 h-9 rounded-xl glass-light flex items-center justify-center flex-shrink-0 border border-white/10 dark:border-gray-700/20">
              <UsersIcon size={18} className="text-gray-600 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                Personal Workspace
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">No team selected</p>
            </div>
          </>
        )}
        <ChevronDownIcon
          size={16}
          className={cn(
            'text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown list */}
      {isOpen && teams.length > 0 && (
        <div
          role="listbox"
          aria-label="Select team"
          className="absolute left-0 right-0 mt-2 z-50 ios-card glass border border-white/10 dark:border-gray-700/20 shadow-ios-lg backdrop-blur-ios rounded-xl overflow-hidden"
        >
          <div className="p-1 space-y-0.5">
            {teams.map((team) => {
              const isActive = activeTeam?.id === team.id
              return (
                <button
                  key={team.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSwitch(team)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                    isActive
                      ? 'text-white bg-gradient-to-r from-[#3FE0A5] to-[#38B897] shadow-ios-sm'
                      : 'text-gray-700 dark:text-gray-300 glass-light hover:glass hover:shadow-ios-sm backdrop-blur-ios'
                  )}
                >
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="w-7 h-7 rounded-lg object-cover border border-white/20 flex-shrink-0"
                    />
                  ) : (
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-gradient-to-br from-[#3FE0A5] to-[#38B897] text-white'
                      )}
                    >
                      {teamInitial(team.name)}
                    </div>
                  )}
                  <span className="truncate font-medium">{team.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state when no teams */}
      {isOpen && teams.length === 0 && (
        <div className="absolute left-0 right-0 mt-2 z-50 ios-card glass border border-white/10 dark:border-gray-700/20 shadow-ios-lg backdrop-blur-ios rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No teams available</p>
        </div>
      )}
    </div>
  )
}

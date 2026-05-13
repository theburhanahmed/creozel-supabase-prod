import React from 'react'
import { useNavigate } from 'react-router-dom'
import { UsersIcon, ArrowRightIcon } from 'lucide-react'

/**
 * Shown in place of the Configuration Panel when `activeTeam` is null.
 * Explains that a team is required to use the Studio and provides a CTA
 * that navigates to the team management page (/team).
 *
 * Requirement 1.5
 */
export const NoTeamEmptyState: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="glass-enhanced rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-6 min-h-[400px]">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3FE0A5]/20 to-emerald-400/10 flex items-center justify-center">
        <UsersIcon
          size={32}
          className="text-[#3FE0A5]"
          aria-hidden="true"
        />
      </div>

      {/* Message */}
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          No team selected
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          The Content Studio requires an active team. Select or create a team to
          start generating content.
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => navigate('/team')}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3FE0A5] to-emerald-400 text-white text-sm font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5] focus-visible:ring-offset-2"
        aria-label="Go to team management"
      >
        Manage teams
        <ArrowRightIcon size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

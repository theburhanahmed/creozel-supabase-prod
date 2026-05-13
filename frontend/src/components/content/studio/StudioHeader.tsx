import React from 'react'
import { ChevronRightIcon, SparklesIcon } from 'lucide-react'

interface StudioHeaderProps {
  teamName: string
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({ teamName }) => {
  return (
    <div className="glass-enhanced rounded-2xl p-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2">
        <span>Create</span>
        <ChevronRightIcon size={12} aria-hidden="true" />
        <span className="text-[#3FE0A5] font-medium">Studio</span>
      </nav>

      {/* Title row */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3FE0A5] to-emerald-400 flex items-center justify-center text-white shadow-sm">
          <SparklesIcon size={20} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            Content Studio
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {teamName}
          </p>
        </div>
      </div>
    </div>
  )
}

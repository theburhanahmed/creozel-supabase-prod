import React from 'react'
import type { ContentJob } from '../../types'

interface StatusBadgeProps {
  status: ContentJob['status']
}

const STATUS_STYLES: Record<ContentJob['status'], string> = {
  pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  running:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400',
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[status] ?? ''}`}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  )
}

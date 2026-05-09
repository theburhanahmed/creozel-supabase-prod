import React from 'react'

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'dots'
  size?: 'sm' | 'md' | 'lg'
  text?: string
  height?: string
  className?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'spinner',
  size = 'md',
  text,
  height = 'h-6',
  className = '',
}) => {
  if (variant === 'skeleton') {
    return (
      <div
        className={`w-full rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse ${height} ${className}`}
        role="status"
        aria-label="Loading"
      />
    )
  }

  const spinnerSize = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }[size]

  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-busy="true">
      <div
        className={`animate-spin rounded-full border-2 border-t-transparent border-[#3FE0A5] ${spinnerSize}`}
        role="status"
        aria-label="Loading"
      />
      {text && <span className="text-sm text-gray-500 dark:text-gray-400">{text}</span>}
    </div>
  )
}

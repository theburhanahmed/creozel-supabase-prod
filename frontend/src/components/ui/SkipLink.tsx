import React from 'react'

export const SkipLink: React.FC<{ targetId: string; className?: string }> = ({ targetId, className = '' }) => (
  <a
    href={`#${targetId}`}
    onClick={(e) => {
      e.preventDefault()
      const el = document.getElementById(targetId)
      if (el) { el.tabIndex = -1; el.focus(); setTimeout(() => el.removeAttribute('tabindex'), 1000) }
    }}
    className={`sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#3FE0A5] focus:text-white focus:rounded-xl focus:shadow-lg ${className}`}
  >
    Skip to content
  </a>
)

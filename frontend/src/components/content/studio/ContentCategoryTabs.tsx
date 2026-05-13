import React from 'react'
import {
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  BookOpenIcon,
} from 'lucide-react'
import type { ContentCategory } from '../../../types'

interface ContentCategoryTabsProps {
  selected: ContentCategory
  creditsByCategory: Partial<Record<ContentCategory, number>>
  creditsUnavailable: boolean
  onChange: (category: ContentCategory) => void
}

interface CategoryConfig {
  value: ContentCategory
  label: string
  icon: React.ReactNode
  /** Tailwind classes for the active accent (background + text + ring) */
  activeClasses: string
  /** Tailwind classes for the active icon wrapper background */
  iconActiveBg: string
  /** Tailwind classes for the inactive icon wrapper background */
  iconInactiveBg: string
}

const CATEGORIES: CategoryConfig[] = [
  {
    value: 'text',
    label: 'Text',
    icon: <FileTextIcon size={18} aria-hidden="true" />,
    activeClasses:
      'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    iconActiveBg: 'bg-violet-500/20 text-violet-600 dark:text-violet-300',
    iconInactiveBg: 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400',
  },
  {
    value: 'image',
    label: 'Image',
    icon: <ImageIcon size={18} aria-hidden="true" />,
    activeClasses:
      'border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300',
    iconActiveBg: 'bg-pink-500/20 text-pink-600 dark:text-pink-300',
    iconInactiveBg: 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400',
  },
  {
    value: 'video',
    label: 'Video',
    icon: <VideoIcon size={18} aria-hidden="true" />,
    activeClasses:
      'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    iconActiveBg: 'bg-blue-500/20 text-blue-600 dark:text-blue-300',
    iconInactiveBg: 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400',
  },
  {
    value: 'audio',
    label: 'Audio',
    icon: <MicIcon size={18} aria-hidden="true" />,
    activeClasses:
      'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    iconActiveBg: 'bg-amber-500/20 text-amber-600 dark:text-amber-300',
    iconInactiveBg: 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400',
  },
  {
    value: 'story',
    label: 'Story',
    icon: <BookOpenIcon size={18} aria-hidden="true" />,
    activeClasses:
      'border-[#3FE0A5] bg-[#3FE0A5]/10 text-emerald-700 dark:text-emerald-300',
    iconActiveBg: 'bg-[#3FE0A5]/20 text-emerald-600 dark:text-emerald-300',
    iconInactiveBg: 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400',
  },
]

/**
 * Horizontal tab bar for selecting a ContentCategory.
 *
 * - Each tab has a unique icon and accent colour.
 * - Displays the credit cost for each category from `creditsByCategory`.
 * - Shows "?" when `creditsUnavailable` is true.
 * - Active tab receives a visible border + background selected-state indicator.
 *
 * Accessibility:
 * - Uses role="tablist" / role="tab" so screen readers announce it correctly.
 * - Active tab carries aria-selected="true".
 * - Keyboard: Tab to focus, Enter/Space to select.
 */
export const ContentCategoryTabs: React.FC<ContentCategoryTabsProps> = ({
  selected,
  creditsByCategory,
  creditsUnavailable,
  onChange,
}) => {
  const formatCredits = (category: ContentCategory): string => {
    if (creditsUnavailable) return '?'
    const cost = creditsByCategory[category]
    if (cost === undefined || cost === null) return '?'
    return String(cost)
  }

  return (
    <div
      role="tablist"
      aria-label="Content category"
      className="flex gap-2 flex-wrap"
    >
      {CATEGORIES.map((cat) => {
        const isActive = selected === cat.value
        const creditLabel = formatCredits(cat.value)

        return (
          <button
            key={cat.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`${cat.label} — ${creditsUnavailable ? 'cost unavailable' : `${creditLabel} credits`}`}
            onClick={() => onChange(cat.value)}
            className={[
              // Base layout
              'flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border',
              'min-w-[80px] flex-1 transition-all duration-200 select-none outline-none',
              // Focus ring
              'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3FE0A5]',
              // Active vs inactive state
              isActive
                ? `${cat.activeClasses} shadow-sm`
                : 'border-transparent glass-light hover:border-gray-200 dark:hover:border-white/20 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
            ].join(' ')}
          >
            {/* Icon */}
            <span
              className={[
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200',
                isActive ? cat.iconActiveBg : cat.iconInactiveBg,
              ].join(' ')}
            >
              {cat.icon}
            </span>

            {/* Label */}
            <span className="text-xs font-semibold leading-none">{cat.label}</span>

            {/* Credit cost */}
            <span
              className={[
                'text-[10px] font-medium leading-none',
                isActive
                  ? 'opacity-80'
                  : 'text-gray-400 dark:text-gray-500',
              ].join(' ')}
              aria-label={`${creditLabel} credits`}
            >
              {creditLabel} cr
            </span>
          </button>
        )
      })}
    </div>
  )
}

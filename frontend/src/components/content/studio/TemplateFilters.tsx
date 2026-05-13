import React, { useCallback, useRef } from 'react'
import {
  TypeIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  BookOpenIcon,
  LayoutGridIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  FacebookIcon,
  YoutubeIcon,
  MusicIcon,
  MailIcon,
  GlobeIcon,
  RssIcon,
  PodcastIcon,
} from 'lucide-react'
import type { ContentCategory, StudioPlatform } from '../../../types'
import { CONTENT_CATEGORIES, STUDIO_PLATFORMS } from '../../../constants/contentFormatRegistry'

export interface TemplateFiltersProps {
  categoryFilter: ContentCategory | 'all'
  platformFilter: StudioPlatform | 'all'
  onCategoryChange: (v: ContentCategory | 'all') => void
  onPlatformChange: (v: StudioPlatform | 'all') => void
}

// ─── Category filter config ───────────────────────────────────────────────────

interface CategoryFilterConfig {
  value: ContentCategory | 'all'
  label: string
  icon: React.ReactNode
  activeClasses: string
}

const CATEGORY_FILTER_CONFIGS: CategoryFilterConfig[] = [
  {
    value: 'all',
    label: 'All',
    icon: <LayoutGridIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-[#3FE0A5] bg-[#3FE0A5]/10 text-emerald-700 dark:text-emerald-300 ring-[#3FE0A5]/30',
  },
  {
    value: 'text',
    label: 'Text',
    icon: <TypeIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/30',
  },
  {
    value: 'image',
    label: 'Image',
    icon: <ImageIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300 ring-pink-500/30',
  },
  {
    value: 'video',
    label: 'Video',
    icon: <VideoIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/30',
  },
  {
    value: 'audio',
    label: 'Audio',
    icon: <MicIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/30',
  },
  {
    value: 'story',
    label: 'Story',
    icon: <BookOpenIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/30',
  },
]

const ALL_CATEGORY_VALUES = CATEGORY_FILTER_CONFIGS.map((c) => c.value)

// ─── Platform filter config ───────────────────────────────────────────────────

interface PlatformFilterConfig {
  value: StudioPlatform | 'all'
  label: string
  icon: React.ReactNode
  activeClasses: string
}

const PLATFORM_FILTER_CONFIGS: PlatformFilterConfig[] = [
  {
    value: 'all',
    label: 'All',
    icon: <LayoutGridIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-[#3FE0A5] bg-[#3FE0A5]/10 text-emerald-700 dark:text-emerald-300 ring-[#3FE0A5]/30',
  },
  {
    value: 'Instagram',
    label: 'Instagram',
    icon: <InstagramIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300 ring-pink-500/30',
  },
  {
    value: 'LinkedIn',
    label: 'LinkedIn',
    icon: <LinkedinIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300 ring-blue-600/30',
  },
  {
    value: 'Twitter / X',
    label: 'Twitter / X',
    icon: <TwitterIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  },
  {
    value: 'Facebook',
    label: 'Facebook',
    icon: <FacebookIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30',
  },
  {
    value: 'YouTube',
    label: 'YouTube',
    icon: <YoutubeIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/30',
  },
  {
    value: 'TikTok',
    label: 'TikTok',
    icon: <MusicIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 ring-fuchsia-500/30',
  },
  {
    value: 'Blog',
    label: 'Blog',
    icon: <RssIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  },
  {
    value: 'Newsletter',
    label: 'Newsletter',
    icon: <MailIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/30',
  },
  {
    value: 'Podcast',
    label: 'Podcast',
    icon: <PodcastIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/30',
  },
  {
    value: 'General',
    label: 'General',
    icon: <GlobeIcon size={14} aria-hidden="true" />,
    activeClasses:
      'border-gray-500 bg-gray-500/10 text-gray-700 dark:text-gray-300 ring-gray-500/30',
  },
]

const ALL_PLATFORM_VALUES = PLATFORM_FILTER_CONFIGS.map((c) => c.value)

// ─── Shared button class helper ───────────────────────────────────────────────

function filterButtonClasses(isActive: boolean, activeClasses: string): string {
  return [
    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium',
    'transition-all duration-200 select-none outline-none',
    'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3FE0A5]',
    isActive
      ? `${activeClasses} shadow-sm ring-1`
      : 'border-transparent glass-light text-gray-600 dark:text-gray-400 hover:border-gray-200 dark:hover:border-white/20 hover:text-gray-800 dark:hover:text-gray-200',
  ].join(' ')
}

// ─── TemplateFilters component ────────────────────────────────────────────────

/**
 * TemplateFilters renders two button-group filter controls above the template
 * grid:
 *   1. Category filter — "All" + the 5 ContentCategory values
 *   2. Platform filter — "All" + the 10 StudioPlatform values
 *
 * Both groups use the same button-group pattern as ToneSelector and
 * PlatformSelector (role="radiogroup" / role="radio", arrow-key navigation).
 *
 * The component is purely presentational — the parent owns state and passes
 * the current filter values and change handlers as props.
 *
 * Requirement 8.4
 */
export const TemplateFilters: React.FC<TemplateFiltersProps> = ({
  categoryFilter,
  platformFilter,
  onCategoryChange,
  onPlatformChange,
}) => {
  const categoryGroupRef = useRef<HTMLDivElement>(null)
  const platformGroupRef = useRef<HTMLDivElement>(null)

  // ── Category keyboard navigation ──────────────────────────────────────────

  const handleCategoryKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLButtonElement>,
      value: ContentCategory | 'all',
    ) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onCategoryChange(value)
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        const idx = ALL_CATEGORY_VALUES.indexOf(value)
        const next = ALL_CATEGORY_VALUES[(idx + 1) % ALL_CATEGORY_VALUES.length]
        onCategoryChange(next)
        focusCategoryButton(next)
        return
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = ALL_CATEGORY_VALUES.indexOf(value)
        const prev =
          ALL_CATEGORY_VALUES[
            (idx - 1 + ALL_CATEGORY_VALUES.length) % ALL_CATEGORY_VALUES.length
          ]
        onCategoryChange(prev)
        focusCategoryButton(prev)
      }
    },
    [onCategoryChange],
  )

  const focusCategoryButton = (value: ContentCategory | 'all') => {
    const btn = categoryGroupRef.current?.querySelector<HTMLButtonElement>(
      `[data-category-filter="${value}"]`,
    )
    btn?.focus()
  }

  // ── Platform keyboard navigation ──────────────────────────────────────────

  const handlePlatformKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLButtonElement>,
      value: StudioPlatform | 'all',
    ) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onPlatformChange(value)
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        const idx = ALL_PLATFORM_VALUES.indexOf(value)
        const next = ALL_PLATFORM_VALUES[(idx + 1) % ALL_PLATFORM_VALUES.length]
        onPlatformChange(next)
        focusPlatformButton(next)
        return
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = ALL_PLATFORM_VALUES.indexOf(value)
        const prev =
          ALL_PLATFORM_VALUES[
            (idx - 1 + ALL_PLATFORM_VALUES.length) % ALL_PLATFORM_VALUES.length
          ]
        onPlatformChange(prev)
        focusPlatformButton(prev)
      }
    },
    [onPlatformChange],
  )

  const focusPlatformButton = (value: StudioPlatform | 'all') => {
    const btn = platformGroupRef.current?.querySelector<HTMLButtonElement>(
      `[data-platform-filter="${value}"]`,
    )
    btn?.focus()
  }

  return (
    <div className="space-y-3">
      {/* ── Category filter ─────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Category
        </p>
        <div
          ref={categoryGroupRef}
          role="radiogroup"
          aria-label="Filter templates by category"
          className="flex flex-wrap gap-1.5"
        >
          {CATEGORY_FILTER_CONFIGS.map((config) => {
            const isActive = categoryFilter === config.value
            return (
              <button
                key={config.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={`${config.label}${isActive ? ', selected' : ''}`}
                data-category-filter={config.value}
                onClick={() => onCategoryChange(config.value)}
                onKeyDown={(e) => handleCategoryKeyDown(e, config.value)}
                tabIndex={isActive ? 0 : -1}
                className={filterButtonClasses(isActive, config.activeClasses)}
              >
                {config.icon}
                <span>{config.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Platform filter ─────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Platform
        </p>
        <div
          ref={platformGroupRef}
          role="radiogroup"
          aria-label="Filter templates by platform"
          className="flex flex-wrap gap-1.5"
        >
          {PLATFORM_FILTER_CONFIGS.map((config) => {
            const isActive = platformFilter === config.value
            return (
              <button
                key={config.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={`${config.label}${isActive ? ', selected' : ''}`}
                data-platform-filter={config.value}
                onClick={() => onPlatformChange(config.value)}
                onKeyDown={(e) => handlePlatformKeyDown(e, config.value)}
                tabIndex={isActive ? 0 : -1}
                className={filterButtonClasses(isActive, config.activeClasses)}
              >
                {config.icon}
                <span>{config.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Re-export the typed const arrays so consumers can derive the full option sets
// without importing from the registry directly.
export { CONTENT_CATEGORIES, STUDIO_PLATFORMS }

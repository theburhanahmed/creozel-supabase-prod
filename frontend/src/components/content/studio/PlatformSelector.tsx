import React, { useCallback, useRef } from 'react'
import {
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  FacebookIcon,
  YoutubeIcon,
  MusicIcon,
  BookOpenIcon,
  MailIcon,
  MicIcon,
  GlobeIcon,
} from 'lucide-react'
import type { StudioPlatform } from '../../../types'
import { STUDIO_PLATFORMS } from '../../../constants/contentFormatRegistry'

export interface PlatformSelectorProps {
  selected: StudioPlatform
  availablePlatforms: StudioPlatform[]
  onChange: (platform: StudioPlatform) => void
}

interface PlatformConfig {
  value: StudioPlatform
  label: string
  icon: React.ReactNode
  /** Tailwind classes for the active accent */
  activeClasses: string
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    value: 'Instagram',
    label: 'Instagram',
    icon: <InstagramIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300 ring-pink-500/30',
  },
  {
    value: 'LinkedIn',
    label: 'LinkedIn',
    icon: <LinkedinIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300 ring-blue-600/30',
  },
  {
    value: 'Twitter / X',
    label: 'Twitter / X',
    icon: <TwitterIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  },
  {
    value: 'Facebook',
    label: 'Facebook',
    icon: <FacebookIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30',
  },
  {
    value: 'YouTube',
    label: 'YouTube',
    icon: <YoutubeIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/30',
  },
  {
    value: 'TikTok',
    label: 'TikTok',
    icon: <MusicIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 ring-fuchsia-500/30',
  },
  {
    value: 'Blog',
    label: 'Blog',
    icon: <BookOpenIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  },
  {
    value: 'Newsletter',
    label: 'Newsletter',
    icon: <MailIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/30',
  },
  {
    value: 'Podcast',
    label: 'Podcast',
    icon: <MicIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/30',
  },
  {
    value: 'General',
    label: 'General',
    icon: <GlobeIcon size={16} aria-hidden="true" />,
    activeClasses:
      'border-[#3FE0A5] bg-[#3FE0A5]/10 text-emerald-700 dark:text-emerald-300 ring-[#3FE0A5]/30',
  },
]

/**
 * Platform selector rendered as a grid of toggle buttons.
 *
 * - Only renders platforms present in `availablePlatforms`.
 * - The full canonical order from STUDIO_PLATFORMS is preserved; platforms
 *   not in `availablePlatforms` are simply omitted.
 * - If `selected` is not in `availablePlatforms`, the component renders
 *   without a selected state (the parent is responsible for defaulting to
 *   General, but the component handles the case gracefully).
 *
 * Accessibility:
 * - Uses role="radiogroup" / role="radio" so screen readers announce it as a
 *   mutually-exclusive option set.
 * - Each option has an explicit aria-label combining the platform name and
 *   its selected state.
 * - Keyboard: Tab to reach the group, Arrow keys to navigate within it,
 *   Enter / Space to select.
 */
export const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  selected,
  availablePlatforms,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Preserve canonical order: filter STUDIO_PLATFORMS down to availablePlatforms
  const visiblePlatforms = STUDIO_PLATFORMS.filter((p) =>
    availablePlatforms.includes(p),
  )

  // Determine the effective selection — if selected is not in the visible set,
  // treat as unselected (parent should have already defaulted to General).
  const effectiveSelected: StudioPlatform | null = visiblePlatforms.includes(selected)
    ? selected
    : null

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, value: StudioPlatform) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onChange(value)
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        const idx = visiblePlatforms.indexOf(value)
        const next = visiblePlatforms[(idx + 1) % visiblePlatforms.length]
        onChange(next)
        focusPlatformButton(next)
        return
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = visiblePlatforms.indexOf(value)
        const prev =
          visiblePlatforms[(idx - 1 + visiblePlatforms.length) % visiblePlatforms.length]
        onChange(prev)
        focusPlatformButton(prev)
      }
    },
    [visiblePlatforms, onChange],
  )

  const focusPlatformButton = (platform: StudioPlatform) => {
    const btn = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-platform="${platform}"]`,
    )
    btn?.focus()
  }

  if (visiblePlatforms.length === 0) {
    return null
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Target platform"
      className="flex flex-wrap gap-2"
    >
      {visiblePlatforms.map((platformValue) => {
        const config = PLATFORM_CONFIGS.find((c) => c.value === platformValue)
        if (!config) return null

        const isActive = effectiveSelected === platformValue

        return (
          <button
            key={platformValue}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${config.label}${isActive ? ', selected' : ''}`}
            data-platform={platformValue}
            onClick={() => onChange(platformValue)}
            onKeyDown={(e) => handleKeyDown(e, platformValue)}
            tabIndex={isActive ? 0 : -1}
            className={[
              // Base layout
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium',
              'transition-all duration-200 select-none outline-none',
              // Focus ring
              'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3FE0A5]',
              // Active vs inactive
              isActive
                ? `${config.activeClasses} shadow-sm ring-1`
                : 'border-transparent glass-light text-gray-600 dark:text-gray-400 hover:border-gray-200 dark:hover:border-white/20 hover:text-gray-800 dark:hover:text-gray-200',
            ].join(' ')}
          >
            {config.icon}
            <span>{config.label}</span>
          </button>
        )
      })}
    </div>
  )
}

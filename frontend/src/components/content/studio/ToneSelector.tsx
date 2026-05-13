import React, { useCallback, useRef } from 'react'
import {
  BriefcaseIcon,
  SmileIcon,
  LaughIcon,
  SparklesIcon,
  ZapIcon,
  BookIcon,
} from 'lucide-react'
import type { StudioTone } from '../../../types'

export interface ToneSelectorProps {
  selected: StudioTone
  brandVoiceActive: boolean
  onChange: (tone: StudioTone) => void
}

interface ToneConfig {
  value: StudioTone
  label: string
  icon: React.ReactNode
  /** Tailwind classes for the active accent */
  activeClasses: string
}

const TONE_CONFIGS: ToneConfig[] = [
  {
    value: 'Professional',
    label: 'Professional',
    icon: <BriefcaseIcon size={15} aria-hidden="true" />,
    activeClasses:
      'border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300 ring-blue-600/30',
  },
  {
    value: 'Casual',
    label: 'Casual',
    icon: <SmileIcon size={15} aria-hidden="true" />,
    activeClasses:
      'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  },
  {
    value: 'Humorous',
    label: 'Humorous',
    icon: <LaughIcon size={15} aria-hidden="true" />,
    activeClasses:
      'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/30',
  },
  {
    value: 'Inspirational',
    label: 'Inspirational',
    icon: <SparklesIcon size={15} aria-hidden="true" />,
    activeClasses:
      'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/30',
  },
  {
    value: 'Persuasive',
    label: 'Persuasive',
    icon: <ZapIcon size={15} aria-hidden="true" />,
    activeClasses:
      'border-[#3FE0A5] bg-[#3FE0A5]/10 text-emerald-700 dark:text-emerald-300 ring-[#3FE0A5]/30',
  },
  {
    value: 'Informative',
    label: 'Informative',
    icon: <BookIcon size={15} aria-hidden="true" />,
    activeClasses:
      'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  },
]

const ALL_TONES: StudioTone[] = TONE_CONFIGS.map((c) => c.value)

/**
 * Tone selector rendered as a row of toggle buttons.
 *
 * - Renders exactly six tone options in a fixed canonical order.
 * - Purely presentational — the parent owns state via useStudioState.
 * - When `brandVoiceActive` is true, shows an inline notice that the brand
 *   voice is overriding the tone setting (Requirement 5.4).
 *
 * Accessibility:
 * - Uses role="radiogroup" / role="radio" for mutually-exclusive semantics.
 * - Arrow keys navigate within the group; Enter / Space select.
 */
export const ToneSelector: React.FC<ToneSelectorProps> = ({
  selected,
  brandVoiceActive,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, value: StudioTone) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onChange(value)
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        const idx = ALL_TONES.indexOf(value)
        const next = ALL_TONES[(idx + 1) % ALL_TONES.length]
        onChange(next)
        focusToneButton(next)
        return
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = ALL_TONES.indexOf(value)
        const prev = ALL_TONES[(idx - 1 + ALL_TONES.length) % ALL_TONES.length]
        onChange(prev)
        focusToneButton(prev)
      }
    },
    [onChange],
  )

  const focusToneButton = (tone: StudioTone) => {
    const btn = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-tone="${tone}"]`,
    )
    btn?.focus()
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="Content tone"
        className="flex flex-wrap gap-2"
      >
        {TONE_CONFIGS.map((config) => {
          const isActive = selected === config.value

          return (
            <button
              key={config.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`${config.label}${isActive ? ', selected' : ''}`}
              data-tone={config.value}
              onClick={() => onChange(config.value)}
              onKeyDown={(e) => handleKeyDown(e, config.value)}
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

      {brandVoiceActive && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400"
        >
          <SparklesIcon size={12} aria-hidden="true" />
          Brand voice active — tone setting overridden
        </p>
      )}
    </div>
  )
}

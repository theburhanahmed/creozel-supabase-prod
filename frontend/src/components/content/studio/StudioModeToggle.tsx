import React, { useCallback, useRef } from 'react'
import { PlusCircleIcon, RefreshCwIcon } from 'lucide-react'
import type { StudioMode } from '../../../types'

interface StudioModeToggleProps {
  mode: StudioMode
  onChange: (mode: StudioMode) => void
}

interface SegmentOption {
  value: StudioMode
  label: string
  icon: React.ReactNode
}

const OPTIONS: SegmentOption[] = [
  {
    value: 'create',
    label: 'Create',
    icon: <PlusCircleIcon size={15} aria-hidden="true" />,
  },
  {
    value: 'repurpose',
    label: 'Repurpose',
    icon: <RefreshCwIcon size={15} aria-hidden="true" />,
  },
]

/**
 * Segmented control that toggles between "Create" and "Repurpose" studio modes.
 *
 * Accessibility:
 * - Uses role="radiogroup" / role="radio" so screen readers announce it as a
 *   mutually-exclusive option set.
 * - Each option is focusable via Tab and activatable with Enter or Space.
 * - The active option carries aria-checked="true".
 */
export const StudioModeToggle: React.FC<StudioModeToggleProps> = ({ mode, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, value: StudioMode) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onChange(value)
      }
      // Arrow-key navigation between segments
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const next: StudioMode = value === 'create' ? 'repurpose' : 'create'
        onChange(next)
        // Move focus to the newly selected button
        const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button')
        buttons?.forEach((btn) => {
          if (btn.dataset.value === next) btn.focus()
        })
      }
    },
    [onChange],
  )

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Studio mode"
      className="inline-flex p-1 rounded-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 backdrop-blur-sm"
    >
      {OPTIONS.map((option) => {
        const isActive = mode === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-value={option.value}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, option.value)}
            tabIndex={isActive ? 0 : -1}
            className={[
              'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'transition-all duration-200 select-none outline-none',
              'focus-visible:ring-2 focus-visible:ring-[#3FE0A5] focus-visible:ring-offset-1',
              isActive
                ? 'bg-gradient-to-r from-[#3FE0A5] to-emerald-400 text-white shadow-md shadow-emerald-500/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/10',
            ].join(' ')}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

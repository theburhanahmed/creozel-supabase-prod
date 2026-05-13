import React from 'react'
import type { ContentFormat, ContentFormatRegistryEntry } from '../../../types'

interface FormatCardProps {
  format: ContentFormat
  entry: ContentFormatRegistryEntry
  isSelected: boolean
  onClick: () => void
}

/**
 * A card representing a single ContentFormat option within ContentFormatGrid.
 *
 * Displays:
 * - Format label (bold)
 * - Format description (muted text)
 * - Compatible platform tags (pill badges)
 *
 * Selected state: highlighted border + background tint.
 *
 * Accessibility:
 * - Rendered as a <button> so it is natively tab-navigable and activatable
 *   via Enter or Space.
 * - aria-pressed reflects the selected state.
 * - aria-label combines label + selected state for screen readers.
 */
export const FormatCard: React.FC<FormatCardProps> = ({
  format,
  entry,
  isSelected,
  onClick,
}) => {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={`${entry.label}${isSelected ? ', selected' : ''}`}
      data-format={format}
      onClick={onClick}
      className={[
        // Base layout
        'w-full text-left flex flex-col gap-2 p-3 rounded-xl border',
        'transition-all duration-200 select-none outline-none',
        // Focus ring
        'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3FE0A5]',
        // Selected vs unselected
        isSelected
          ? 'border-[#3FE0A5] bg-[#3FE0A5]/10 shadow-sm shadow-emerald-500/10'
          : 'border-transparent glass-light hover:border-gray-200 dark:hover:border-white/20',
      ].join(' ')}
    >
      {/* Label */}
      <span
        className={[
          'text-sm font-semibold leading-tight',
          isSelected
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-gray-800 dark:text-gray-100',
        ].join(' ')}
      >
        {entry.label}
      </span>

      {/* Description */}
      <span className="text-xs text-gray-500 dark:text-gray-400 leading-snug line-clamp-2">
        {entry.description}
      </span>

      {/* Compatible platform tags */}
      {entry.compatiblePlatforms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5" aria-label="Compatible platforms">
          {entry.compatiblePlatforms.map((platform) => (
            <span
              key={platform}
              className={[
                'inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium leading-none',
                isSelected
                  ? 'bg-[#3FE0A5]/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400',
              ].join(' ')}
            >
              {platform}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

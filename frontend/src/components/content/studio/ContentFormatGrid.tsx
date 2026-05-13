import React from 'react'
import { useContentFormats } from '../../../hooks/useContentFormats'
import { FormatCard } from './FormatCard'
import type { ContentCategory, ContentFormat } from '../../../types'

interface ContentFormatGridProps {
  category: ContentCategory
  selected: ContentFormat
  onChange: (format: ContentFormat) => void
}

/**
 * Scrollable grid of FormatCard components for the given ContentCategory.
 *
 * - Uses `useContentFormats` to derive the Phase 1 formats for the category,
 *   sorted alphabetically by label.
 * - Highlights the currently selected format with a border + background tint.
 * - Keyboard accessible: each card is a <button> (tab-navigable, Enter/Space).
 *
 * Accessibility:
 * - Container uses role="listbox" so screen readers announce it as a
 *   selection list.
 * - aria-label identifies the purpose of the listbox.
 */
export const ContentFormatGrid: React.FC<ContentFormatGridProps> = ({
  category,
  selected,
  onChange,
}) => {
  const formats = useContentFormats(category)

  if (formats.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
        No formats available for this category.
      </p>
    )
  }

  return (
    <div
      role="listbox"
      aria-label={`${category} content formats`}
      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
    >
      {formats.map(([format, entry]) => (
        <FormatCard
          key={format}
          format={format}
          entry={entry}
          isSelected={selected === format}
          onClick={() => onChange(format)}
        />
      ))}
    </div>
  )
}

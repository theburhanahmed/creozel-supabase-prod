import React, { useMemo } from 'react'
import { CONTENT_FORMAT_REGISTRY } from '../../../constants/contentFormatRegistry'
import { FormatCard } from './FormatCard'
import type { ContentFormat } from '../../../types'

// ─── Repurposing Paths (Requirement 17.4) ─────────────────────────────────────
// Explicit map of source format → valid target formats.
// For source formats not listed here, no repurposing paths are available.

const REPURPOSING_PATHS: Partial<Record<ContentFormat, ContentFormat[]>> = {
  blog_post: ['carousel', 'thread', 'caption', 'newsletter', 'short', 'tiktok_video', 'podcast_episode'],
  youtube_video: ['short', 'tiktok_video', 'reel', 'repurposed_clip', 'blog_post', 'thread'],
  podcast_episode: ['audio_blog', 'blog_post', 'thread', 'caption', 'quote_post'],
  reel: ['caption', 'story_single', 'tweet'],
  short: ['caption', 'story_single', 'tweet'],
  tiktok_video: ['caption', 'story_single', 'tweet'],
  carousel: ['blog_post', 'thread', 'newsletter'],
}

/**
 * Derives the valid repurposing target formats for a given source format.
 * Returns an empty array for source formats not in REPURPOSING_PATHS.
 */
export function getRepurposingTargets(sourceFormat: ContentFormat): ContentFormat[] {
  return REPURPOSING_PATHS[sourceFormat] ?? []
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RepurposingTargetSelectorProps {
  sourceFormat: ContentFormat
  selected: ContentFormat | null
  onChange: (format: ContentFormat) => void
}

/**
 * RepurposingTargetSelector
 *
 * Renders a filtered ContentFormat grid showing only the valid repurposing
 * targets for the given source format, as defined by the REPURPOSING_PATHS
 * map (Requirement 17.4).
 *
 * - Formats outside the valid paths are not rendered (not merely disabled).
 * - Shows an empty state when no valid targets exist for the source format.
 *
 * Accessibility:
 * - Container uses role="listbox" so screen readers announce it as a
 *   selection list.
 * - aria-label identifies the purpose of the listbox.
 */
export const RepurposingTargetSelector: React.FC<RepurposingTargetSelectorProps> = ({
  sourceFormat,
  selected,
  onChange,
}) => {
  // Derive valid target formats from the repurposing paths map
  const validTargets = useMemo(() => getRepurposingTargets(sourceFormat), [sourceFormat])

  if (validTargets.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No repurposing paths available for this format.
        </p>
        <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
          Select a different source asset to see available target formats.
        </p>
      </div>
    )
  }

  return (
    <div
      role="listbox"
      aria-label="Repurposing target formats"
      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
    >
      {validTargets.map((format) => {
        const entry = CONTENT_FORMAT_REGISTRY[format]
        return (
          <FormatCard
            key={format}
            format={format}
            entry={entry}
            isSelected={selected === format}
            onClick={() => onChange(format)}
          />
        )
      })}
    </div>
  )
}

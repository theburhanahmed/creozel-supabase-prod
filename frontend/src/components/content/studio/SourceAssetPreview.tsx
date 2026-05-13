import React from 'react'
import { ImageIcon, MusicIcon, FileTextIcon } from 'lucide-react'
import { CONTENT_FORMAT_REGISTRY } from '../../../constants/contentFormatRegistry'
import type { RepurposingSource } from '../../../types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters shown in the text excerpt preview (Requirement 17.3). */
const TEXT_EXCERPT_MAX_CHARS = 300

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for SourceAssetPreview.
 *
 * Matches the SourceAssetPreviewProps interface defined in design.md.
 */
export interface SourceAssetPreviewProps {
  /**
   * The currently selected repurposing source, or null/undefined when nothing
   * is selected. When null/undefined the component renders nothing.
   */
  source: RepurposingSource | null | undefined
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * TextPreview
 *
 * Renders a text excerpt (up to 300 chars) from `source.promptExcerpt`.
 * Requirement 17.3 — text assets show a text excerpt up to 300 characters.
 */
const TextPreview: React.FC<{ excerpt: string | null }> = ({ excerpt }) => {
  if (!excerpt) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 italic">
        No preview available.
      </p>
    )
  }

  const truncated =
    excerpt.length > TEXT_EXCERPT_MAX_CHARS
      ? excerpt.slice(0, TEXT_EXCERPT_MAX_CHARS) + '…'
      : excerpt

  return (
    <div
      className="rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3"
      aria-label="Text excerpt preview"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <FileTextIcon
          size={13}
          className="text-gray-400 dark:text-gray-500 shrink-0"
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Excerpt
        </span>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
        {truncated}
      </p>
    </div>
  )
}

/**
 * ImageVideoPreview
 *
 * Renders a thumbnail image using `source.previewUrl`.
 * Requirement 17.3 — image/video assets show a thumbnail image.
 */
const ImageVideoPreview: React.FC<{
  previewUrl: string | null
  label: string
}> = ({ previewUrl, label }) => {
  if (!previewUrl) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 aspect-video"
        aria-label="No thumbnail available"
      >
        <ImageIcon
          size={24}
          className="text-gray-300 dark:text-gray-600"
          aria-hidden="true"
        />
        <span className="text-xs text-gray-400 dark:text-gray-500">
          No thumbnail
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 aspect-video bg-gray-100 dark:bg-gray-800">
      <img
        src={previewUrl}
        alt={label}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  )
}

/**
 * AudioPreview
 *
 * Renders a waveform placeholder (visual, not an actual waveform).
 * Requirement 17.3 — audio assets show a waveform placeholder.
 */
const AudioPreview: React.FC = () => {
  // Generate a static set of bar heights to simulate a waveform shape.
  const bars = [4, 8, 14, 10, 18, 12, 20, 16, 22, 18, 14, 20, 16, 10, 18, 12, 8, 16, 10, 6]

  return (
    <div
      className="flex items-center justify-center gap-1 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-5"
      role="img"
      aria-label="Audio waveform placeholder"
    >
      <MusicIcon
        size={14}
        className="text-[#3FE0A5] shrink-0 mr-1"
        aria-hidden="true"
      />
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-[#3FE0A5]/60 dark:bg-[#3FE0A5]/50 shrink-0"
          style={{ height: `${height}px` }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

// ─── SourceAssetPreview ───────────────────────────────────────────────────────

/**
 * SourceAssetPreview
 *
 * Displays a preview of the selected repurposing source asset.
 *
 * When `source` is null/undefined: renders nothing (null).
 *
 * When a source is selected, renders:
 * - Format label (from `source.format`, or "Unknown format" if null)
 * - Platform (if available from the registry entry's compatiblePlatforms)
 * - A type-appropriate preview:
 *   - Text assets (category === 'text'): text excerpt up to 300 chars
 *   - Image/video assets (category === 'image' | 'video'): thumbnail image
 *   - Audio assets (category === 'audio'): waveform placeholder
 *   - Story assets: treated as image/video (thumbnail)
 *   - Fallback "Untitled" label when `source.label` is empty/null
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.7, 17.9, 17.10, 15.1, 15.2
 */
export const SourceAssetPreview: React.FC<SourceAssetPreviewProps> = ({
  source,
}) => {
  // When no source is selected, render nothing (Requirement 17.2).
  if (!source) return null

  // ── Derived values ─────────────────────────────────────────────────────────

  const formatLabel = source.format
    ? (CONTENT_FORMAT_REGISTRY[source.format]?.label ?? source.format)
    : 'Unknown format'

  const registryEntry = source.format
    ? CONTENT_FORMAT_REGISTRY[source.format]
    : null

  const category = registryEntry?.category ?? null

  // Show the first compatible platform as a representative platform hint.
  const platformHint =
    registryEntry?.compatiblePlatforms?.[0] ?? null

  // Fallback label when source.label is empty/null (Requirement 17.3).
  const displayLabel =
    source.label && source.label.trim().length > 0
      ? source.label
      : 'Untitled'

  // ── Preview selection ──────────────────────────────────────────────────────

  const renderPreview = () => {
    if (category === 'text') {
      return <TextPreview excerpt={source.promptExcerpt} />
    }
    if (category === 'audio') {
      return <AudioPreview />
    }
    // image, video, story — or unknown category — fall back to thumbnail
    return (
      <ImageVideoPreview
        previewUrl={source.previewUrl}
        label={displayLabel}
      />
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col gap-3 p-3 rounded-xl border border-gray-200 dark:border-white/10 glass-light"
      aria-label={`Preview of ${displayLabel}`}
    >
      {/* ── Header: label + format + platform ──────────────────────────── */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        {/* Asset label */}
        <p
          className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate"
          title={displayLabel}
        >
          {displayLabel}
        </p>

        {/* Format + platform badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-mono"
            aria-label={`Format: ${formatLabel}`}
          >
            {formatLabel}
          </span>
          {platformHint && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#3FE0A5]/10 text-[#3FE0A5] dark:text-[#3FE0A5]"
              aria-label={`Platform: ${platformHint}`}
            >
              {platformHint}
            </span>
          )}
        </div>
      </div>

      {/* ── Type-specific preview ───────────────────────────────────────── */}
      {renderPreview()}
    </div>
  )
}

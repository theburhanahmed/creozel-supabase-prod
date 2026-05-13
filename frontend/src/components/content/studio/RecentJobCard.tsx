import React, { useCallback } from 'react'
import {
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  BookOpenIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { StatusBadge } from '../StatusBadge'
import type { ContentJob } from '../../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for RecentJobCard.
 *
 * Matches the RecentJobCardProps interface defined in design.md.
 */
export interface RecentJobCardProps {
  /** The content job to display. */
  job: ContentJob
  /** Called when the user clicks the card body to load the job result. */
  onSelect: () => void
  /** Called when the user clicks the "Re-use Config" button. */
  onReuseConfig: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maximum characters shown in the prompt excerpt (Requirement 13.4). */
const PROMPT_EXCERPT_MAX = 80

/**
 * Returns the first `PROMPT_EXCERPT_MAX` characters of a prompt, appending
 * an ellipsis when the prompt is longer (Requirement 13.4).
 */
function getPromptExcerpt(prompt: string): string {
  if (prompt.length <= PROMPT_EXCERPT_MAX) return prompt
  return `${prompt.slice(0, PROMPT_EXCERPT_MAX)}…`
}

/**
 * Produces a human-readable relative timestamp from an ISO date string.
 *
 * Examples: "just now", "5 minutes ago", "2 hours ago", "3 days ago".
 *
 * This is a lightweight implementation that avoids adding a date library
 * dependency. It covers the ranges most relevant for "recent" jobs.
 *
 * Requirement 13.4.
 */
function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'just now'

  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 60) return 'just now'

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
  }

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`
  }

  const diffYears = Math.floor(diffMonths / 12)
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`
}

// ─── Content type icon map ────────────────────────────────────────────────────

/**
 * Maps a ContentJob `type` to a Lucide icon component and an accent colour
 * class, matching the palette used in ContentCategoryTabs.
 *
 * Requirement 13.4: display a content type icon based on job.type.
 */
const TYPE_ICON_MAP: Record<
  ContentJob['type'],
  { Icon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>; colorClass: string }
> = {
  text: {
    Icon: FileTextIcon as React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>,
    colorClass: 'text-blue-500 dark:text-blue-400 bg-blue-500/10',
  },
  image: {
    Icon: ImageIcon as React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>,
    colorClass: 'text-pink-500 dark:text-pink-400 bg-pink-500/10',
  },
  video: {
    Icon: VideoIcon as React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>,
    colorClass: 'text-red-500 dark:text-red-400 bg-red-500/10',
  },
  audio: {
    Icon: MicIcon as React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>,
    colorClass: 'text-orange-500 dark:text-orange-400 bg-orange-500/10',
  },
}

/** Fallback icon for unknown/future content types. */
const FALLBACK_ICON = {
  Icon: BookOpenIcon as React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>,
  colorClass: 'text-gray-500 dark:text-gray-400 bg-gray-500/10',
}

// ─── RecentJobCard ────────────────────────────────────────────────────────────

/**
 * RecentJobCard
 *
 * Displays a single recent content job in the RecentJobsPanel list.
 *
 * Layout (left → right):
 * 1. Content type icon (coloured, rounded square)
 * 2. Main content column:
 *    - Prompt excerpt (first 80 chars + ellipsis)
 *    - Row: StatusBadge · relative timestamp · credit cost
 * 3. "Re-use Config" button (completed jobs only, right-aligned)
 *
 * Behaviour:
 * - Clicking the card body calls `onSelect()` to load the job result into
 *   the Output Panel (Requirement 13.4, 13.6).
 * - The "Re-use Config" button is shown only when `job.status === 'completed'`
 *   (Requirement 13.4, 13.6). Clicking it calls `onReuseConfig()` without
 *   also triggering `onSelect()`.
 *
 * Accessibility:
 * - The card is a <button> for keyboard navigation.
 * - The "Re-use Config" button stops event propagation so it does not also
 *   trigger the card's onClick.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */
export const RecentJobCard: React.FC<RecentJobCardProps> = ({
  job,
  onSelect,
  onReuseConfig,
}) => {
  const { Icon, colorClass } = TYPE_ICON_MAP[job.type] ?? FALLBACK_ICON

  const promptExcerpt = getPromptExcerpt(job.prompt)
  const relativeTime = formatRelativeTime(job.created_at)
  const creditLabel = `${job.credits_used} credits`
  const isCompleted = job.status === 'completed'

  // Stop the Re-use Config click from bubbling up to the card's onSelect
  const handleReuseConfig = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      onReuseConfig()
    },
    [onReuseConfig],
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`View job: ${promptExcerpt}`}
      className={[
        'w-full text-left flex items-start gap-3 p-3 rounded-xl border',
        'transition-all duration-200 select-none outline-none',
        'glass-light border-transparent',
        'hover:border-gray-200 dark:hover:border-white/20 hover:shadow-sm',
        'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3FE0A5]',
      ].join(' ')}
    >
      {/* ── Content type icon ─────────────────────────────────────────────── */}
      <div
        className={[
          'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5',
          colorClass,
        ].join(' ')}
        aria-hidden="true"
      >
        <Icon size={16} />
      </div>

      {/* ── Main content column ───────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Prompt excerpt (Req 13.4) */}
        <p
          className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug truncate"
          title={job.prompt}
        >
          {promptExcerpt}
        </p>

        {/* Meta row: StatusBadge · timestamp · credit cost */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status badge (Req 13.4) */}
          <StatusBadge status={job.status} />

          {/* Relative timestamp (Req 13.4) */}
          <span
            className="text-xs text-gray-400 dark:text-gray-500"
            aria-label={`Created ${relativeTime}`}
          >
            {relativeTime}
          </span>

          {/* Credit cost (Req 13.4) */}
          <span
            className="text-xs text-gray-400 dark:text-gray-500"
            aria-label={`Cost: ${creditLabel}`}
          >
            {creditLabel}
          </span>
        </div>
      </div>

      {/* ── Re-use Config button (completed jobs only, Req 13.4, 13.6) ────── */}
      {isCompleted && (
        <button
          type="button"
          onClick={handleReuseConfig}
          aria-label="Re-use configuration from this job"
          className={[
            'shrink-0 self-center',
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg',
            'text-xs font-medium',
            'bg-gray-100 dark:bg-white/10',
            'text-gray-600 dark:text-gray-300',
            'hover:bg-gray-200 dark:hover:bg-white/20',
            'transition-colors duration-150 outline-none',
            'focus-visible:ring-2 focus-visible:ring-[#3FE0A5]',
          ].join(' ')}
        >
          <RotateCcwIcon size={11} aria-hidden="true" />
          Re-use Config
        </button>
      )}
    </button>
  )
}

import React, { useState } from 'react'
import {
  ClockIcon,
  ImageIcon,
  Loader2Icon,
  AlertCircleIcon,
  BriefcaseIcon,
} from 'lucide-react'
import { useRepurposingSources } from '../../../hooks/useRepurposingSources'
import type { RepurposingSource } from '../../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for RepurposingSourcePicker.
 *
 * Matches the RepurposingSourcePickerProps interface defined in design.md.
 */
export interface RepurposingSourcePickerProps {
  /** The active team ID — passed to useRepurposingSources. */
  teamId: string
  /** The current user ID — passed to useRepurposingSources. */
  userId: string
  /** The currently selected source, or null if none is selected. */
  selectedSource: RepurposingSource | null
  /** Called when the user selects a source. */
  onSelect: (source: RepurposingSource) => void
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type SourceTab = 'jobs' | 'media'

// ─── SourceJobList ────────────────────────────────────────────────────────────

interface SourceJobListProps {
  sources: RepurposingSource[]
  selectedSource: RepurposingSource | null
  onSelect: (source: RepurposingSource) => void
}

/**
 * SourceJobList
 *
 * Renders a list of completed job sources (type === 'job') from
 * useRepurposingSources. Each row shows the job label, format, and prompt
 * excerpt. Clicking a row calls onSelect.
 *
 * Requirements: 17.1, 17.2, 17.3
 */
const SourceJobList: React.FC<SourceJobListProps> = ({
  sources,
  selectedSource,
  onSelect,
}) => {
  if (sources.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-10 text-center gap-2"
        aria-label="No recent jobs available"
      >
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <ClockIcon
            size={18}
            className="text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          No recent jobs
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Completed generation jobs will appear here.
        </p>
      </div>
    )
  }

  return (
    <ul
      className="flex flex-col gap-2"
      aria-label={`${sources.length} recent job${sources.length === 1 ? '' : 's'}`}
    >
      {sources.map((source) => {
        const isSelected = selectedSource?.id === source.id && selectedSource?.type === 'job'
        return (
          <li key={source.id}>
            <button
              type="button"
              onClick={() => onSelect(source)}
              aria-label={`Select job: ${source.label}`}
              aria-pressed={isSelected}
              className={[
                'w-full text-left flex items-start gap-3 p-3 rounded-xl border',
                'transition-all duration-200 select-none outline-none',
                isSelected
                  ? 'border-[#3FE0A5] bg-[#3FE0A5]/5 dark:bg-[#3FE0A5]/10'
                  : 'border-transparent glass-light hover:border-gray-200 dark:hover:border-white/20 hover:shadow-sm',
                'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3FE0A5]',
              ].join(' ')}
            >
              {/* Icon */}
              <div
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 bg-blue-500/10 text-blue-500 dark:text-blue-400"
                aria-hidden="true"
              >
                <ClockIcon size={16} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {source.label}
                </p>
                {source.format && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                    {source.format}
                  </span>
                )}
                {source.promptExcerpt && (
                  <p
                    className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed"
                    title={source.promptExcerpt}
                  >
                    {source.promptExcerpt}
                  </p>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── SourceMediaGrid ──────────────────────────────────────────────────────────

interface SourceMediaGridProps {
  sources: RepurposingSource[]
  selectedSource: RepurposingSource | null
  onSelect: (source: RepurposingSource) => void
}

/**
 * SourceMediaGrid
 *
 * Renders a grid of media item sources (type === 'media') from
 * useRepurposingSources. Each cell shows a thumbnail (or placeholder icon)
 * and the item label. Clicking a cell calls onSelect.
 *
 * Requirements: 17.1, 17.2, 17.3
 */
const SourceMediaGrid: React.FC<SourceMediaGridProps> = ({
  sources,
  selectedSource,
  onSelect,
}) => {
  if (sources.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-10 text-center gap-2"
        aria-label="No media items available"
      >
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <ImageIcon
            size={18}
            className="text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          No media items
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Uploaded media will appear here.
        </p>
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 gap-2"
      role="list"
      aria-label={`${sources.length} media item${sources.length === 1 ? '' : 's'}`}
    >
      {sources.map((source) => {
        const isSelected = selectedSource?.id === source.id && selectedSource?.type === 'media'
        return (
          <div key={source.id} role="listitem">
            <button
              type="button"
              onClick={() => onSelect(source)}
              aria-label={`Select media: ${source.label}`}
              aria-pressed={isSelected}
              className={[
                'w-full flex flex-col rounded-xl border overflow-hidden',
                'transition-all duration-200 select-none outline-none',
                isSelected
                  ? 'border-[#3FE0A5] ring-2 ring-[#3FE0A5]/30'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-sm',
                'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3FE0A5]',
              ].join(' ')}
            >
              {/* Thumbnail or placeholder */}
              <div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                {source.previewUrl ? (
                  <img
                    src={source.previewUrl}
                    alt={source.label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon
                    size={24}
                    className="text-gray-300 dark:text-gray-600"
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Label */}
              <div className="px-2 py-1.5 text-left">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                  {source.label}
                </p>
                {source.format && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">
                    {source.format}
                  </p>
                )}
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── RepurposingSourcePicker ──────────────────────────────────────────────────

/**
 * RepurposingSourcePicker
 *
 * Renders a tab bar with "Recent Jobs" and "Media Library" tabs. The active
 * tab determines which sub-component is shown:
 * - Recent Jobs → SourceJobList (sources with type === 'job')
 * - Media Library → SourceMediaGrid (sources with type === 'media')
 *
 * States:
 * - Loading: spinner while useRepurposingSources is fetching
 * - Error: error message with retry button when the fetch fails
 * - Empty: per-tab empty state when no sources exist for that tab
 * - Populated: SourceJobList or SourceMediaGrid
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.7, 17.9, 17.10, 15.1, 15.2
 */
export const RepurposingSourcePicker: React.FC<RepurposingSourcePickerProps> = ({
  teamId,
  userId,
  selectedSource,
  onSelect,
}) => {
  const [activeTab, setActiveTab] = useState<SourceTab>('jobs')

  const { sources, isLoading, error, refetch } = useRepurposingSources(teamId, userId)

  // Partition sources by type
  const jobSources = sources.filter((s) => s.type === 'job')
  const mediaSources = sources.filter((s) => s.type === 'media')

  // ── Tab definitions ────────────────────────────────────────────────────────

  const tabs: Array<{ id: SourceTab; label: string; count: number; icon: React.ReactNode }> = [
    {
      id: 'jobs',
      label: 'Recent Jobs',
      count: jobSources.length,
      icon: <BriefcaseIcon size={14} aria-hidden="true" />,
    },
    {
      id: 'media',
      label: 'Media Library',
      count: mediaSources.length,
      icon: <ImageIcon size={14} aria-hidden="true" />,
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Source picker tabs"
        className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5"
      >
        {tabs.map(({ id, label, count, icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`source-tab-${id}`}
              aria-selected={isActive}
              aria-controls={`source-panel-${id}`}
              onClick={() => setActiveTab(id)}
              className={[
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg',
                'text-sm font-medium transition-all duration-200 outline-none',
                'focus-visible:ring-2 focus-visible:ring-[#3FE0A5]',
                isActive
                  ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              ].join(' ')}
            >
              {icon}
              <span>{label}</span>
              {/* Badge showing count (only when not loading and no error) */}
              {!isLoading && !error && (
                <span
                  className={[
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-semibold',
                    isActive
                      ? 'bg-[#3FE0A5]/20 text-[#3FE0A5]'
                      : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400',
                  ].join(' ')}
                  aria-label={`${count} ${label.toLowerCase()}`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────────── */}
      <div
        role="tabpanel"
        id={`source-panel-${activeTab}`}
        aria-labelledby={`source-tab-${activeTab}`}
      >
        {/* Loading state */}
        {isLoading && (
          <div
            className="flex items-center justify-center gap-2 py-10 text-gray-400 dark:text-gray-500"
            role="status"
            aria-label="Loading sources"
          >
            <Loader2Icon size={18} className="animate-spin shrink-0" aria-hidden="true" />
            <span className="text-sm">Loading sources…</span>
          </div>
        )}

        {/* Error state (Requirement 17.5) */}
        {!isLoading && error && (
          <div
            className="flex flex-col items-center justify-center gap-3 py-10 text-center"
            role="alert"
            aria-live="polite"
          >
            <AlertCircleIcon
              size={24}
              className="text-red-400 dark:text-red-500 shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Failed to load sources.
            </p>
            <button
              type="button"
              onClick={refetch}
              className={[
                'text-xs font-medium px-3 py-1.5 rounded-lg',
                'border border-gray-200 dark:border-white/20',
                'text-gray-600 dark:text-gray-300',
                'hover:bg-gray-50 dark:hover:bg-white/5',
                'transition-colors duration-150 outline-none',
                'focus-visible:ring-2 focus-visible:ring-[#3FE0A5]',
              ].join(' ')}
            >
              Retry
            </button>
          </div>
        )}

        {/* Content — only shown when not loading and no error */}
        {!isLoading && !error && (
          <>
            {activeTab === 'jobs' && (
              <SourceJobList
                sources={jobSources}
                selectedSource={selectedSource}
                onSelect={onSelect}
              />
            )}
            {activeTab === 'media' && (
              <SourceMediaGrid
                sources={mediaSources}
                selectedSource={selectedSource}
                onSelect={onSelect}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

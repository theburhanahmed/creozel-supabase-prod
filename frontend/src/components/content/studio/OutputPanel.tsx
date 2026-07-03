import React, { useEffect, useState } from 'react'
import { Loader2Icon, SendIcon, XCircleIcon } from 'lucide-react'
import { JobStatusDisplay } from './JobStatusDisplay'
import { OutputActions } from './OutputActions'
import {
  TextResultViewer,
  ImageResultViewer,
  AudioResultViewer,
  VideoResultViewer,
} from '../ResultViewer'
import type { ContentJob } from '../../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for OutputPanel.
 *
 * Matches the OutputPanelProps interface defined in design.md.
 */
export interface OutputPanelProps {
  /** The active content job, or null when no job is active. */
  activeJob: ContentJob | null
  /** Called when the user clicks the Regenerate button. */
  onRegenerate: () => void
  /**
   * Called when the user clicks the Cancel button (shown while job is
   * pending or running). Requirement 10.7.
   */
  onCancel: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Job types that require fetching inline text content from result_url.
 * Requirements 11.2, 11.5.
 * Note: 'video' is intentionally excluded — video jobs now produce .mp4 files
 * rendered by VideoResultViewer's native <video> player, not inline text.
 */
const TEXT_FETCH_TYPES: ReadonlySet<ContentJob['type']> = new Set(['text'])

/**
 * Statuses that allow the Copy, Download, and Publish buttons to be enabled.
 * Requirement 11.11.
 */
const COMPLETED_STATUS: ContentJob['status'] = 'completed'

// ─── OutputPanel ──────────────────────────────────────────────────────────────

/**
 * OutputPanel
 *
 * The right-hand panel of the Content Generation Studio. Displays the active
 * job's status, renders generated content by type, and provides action buttons.
 *
 * Behaviour:
 * - When `activeJob` is null: renders an empty/placeholder state.
 * - Always renders `JobStatusDisplay` at the top when a job is active (Req 11.1).
 * - Delegates content rendering to the appropriate ResultViewer sub-component
 *   based on job type (Req 11.2, 11.3, 11.4).
 * - Shows a loading indicator while fetching inline text content (Req 11.8).
 * - Disables Copy, Download, and Publish when job status is not `completed`
 *   or while fetching inline text content (Req 11.8, 11.11).
 * - Shows Regenerate button when job reaches a terminal status (Req 11.10).
 * - Delegates Copy/Download/Publish/Regenerate to the OutputActions component
 *   (task 13.3).
 *
 * Requirements: 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2, 11.3, 11.4,
 *               11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12
 */
export const OutputPanel: React.FC<OutputPanelProps> = ({ activeJob, onRegenerate, onCancel }) => {
  // ── Inline text fetch state (for text/video jobs) ──────────────────────────
  const [isFetchingContent, setIsFetchingContent] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)

  // Reset fetch state whenever the active job changes
  useEffect(() => {
    setIsFetchingContent(false)
    setFetchError(false)
    setTextContent(null)
  }, [activeJob?.id])

  // Track whether the ResultViewer sub-component is fetching content.
  // TextResultViewer and VideoResultViewer manage their own fetch internally,
  // so we observe the job's result_url availability to derive the loading state
  // for the action buttons.
  useEffect(() => {
    if (
      !activeJob ||
      activeJob.status !== COMPLETED_STATUS ||
      !TEXT_FETCH_TYPES.has(activeJob.type) ||
      !activeJob.result_url
    ) {
      setIsFetchingContent(false)
      return
    }

    // Kick off a parallel fetch to track loading state for the action buttons.
    // The ResultViewer sub-component does its own fetch for rendering; this
    // fetch is solely to populate `textContent` for the Copy button and to
    // drive the `isFetchingContent` flag that gates the action buttons.
    setIsFetchingContent(true)
    setFetchError(false)
    setTextContent(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    fetch(activeJob.result_url, { signal: controller.signal })
      .then((res) => res.text())
      .then((t) => {
        setTextContent(t)
        setIsFetchingContent(false)
      })
      .catch(() => {
        setFetchError(true)
        setTextContent(null)
        setIsFetchingContent(false)
      })
      .finally(() => clearTimeout(timeoutId))

    return () => {
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [activeJob])

  // ── Derived flags ──────────────────────────────────────────────────────────

  const isCompleted = activeJob?.status === COMPLETED_STATUS

  // ── Empty / placeholder state ──────────────────────────────────────────────

  if (!activeJob) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full min-h-[300px] rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 p-8 text-center"
        aria-label="Output panel — no active job"
      >
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
          <SendIcon
            size={24}
            className="text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
        </div>
        <p className="text-base font-medium text-gray-600 dark:text-gray-300 mb-1">
          No content generated yet
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Configure your options and click <strong>Generate</strong> to see results here.
        </p>
      </div>
    )
  }

  // ── Active job view ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full" aria-label="Output panel">

      {/* ── Job status header (Req 11.1) ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <JobStatusDisplay job={activeJob} />

        {/* Cancel button — visible while job is pending or running (Req 10.7) */}
        {(activeJob.status === 'pending' || activeJob.status === 'running') && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel generation job"
            className={[
              'inline-flex items-center gap-1.5',
              'px-3 py-1.5 rounded-lg text-sm font-medium',
              'border border-red-300 dark:border-red-700',
              'text-red-600 dark:text-red-400',
              'bg-red-50 dark:bg-red-900/20',
              'hover:bg-red-100 dark:hover:bg-red-900/40',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400',
            ].join(' ')}
          >
            <XCircleIcon size={14} aria-hidden="true" className="shrink-0" />
            <span>Cancel</span>
          </button>
        )}
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      {isCompleted && (
        <div className="flex-1">
          {/* Loading indicator while fetching inline text content (Req 11.8) */}
          {isFetchingContent && TEXT_FETCH_TYPES.has(activeJob.type) && (
            <div
              className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 py-2"
              aria-live="polite"
              aria-label="Loading generated content"
            >
              <Loader2Icon size={14} className="animate-spin" aria-hidden="true" />
              <span>Loading content…</span>
            </div>
          )}

          {/* Delegate to the appropriate ResultViewer sub-component (Req 11.2–11.4) */}
          {activeJob.type === 'image' && (
            <ImageResultViewer job={activeJob} />
          )}
          {activeJob.type === 'audio' && (
            <AudioResultViewer job={activeJob} />
          )}
          {activeJob.type === 'video' && (
            <VideoResultViewer job={activeJob} />
          )}
          {activeJob.type === 'text' && (
            <TextResultViewer job={activeJob} />
          )}
        </div>
      )}

      {/* ── Error state for failed jobs (Req 10.6) ───────────────────────── */}
      {activeJob.status === 'failed' && (
        <div
          className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4"
          role="alert"
        >
          <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
            Generation failed
          </p>
          <p className="text-sm text-red-600 dark:text-red-300">
            {activeJob.error_message ?? 'An unknown error occurred.'}
          </p>
        </div>
      )}

      {/* ── Cancelled state ───────────────────────────────────────────────── */}
      {activeJob.status === 'cancelled' && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generation was cancelled.
          </p>
        </div>
      )}

      {/* ── Action buttons (Copy, Download, Publish, Regenerate) ──────────── */}
      {/* Delegated to OutputActions (task 13.3). Regenerate is also rendered  */}
      {/* inside OutputActions so the standalone Regenerate button above is    */}
      {/* removed to avoid duplication.                                        */}
      <OutputActions
        job={activeJob}
        textContent={textContent}
        isFetchingContent={isFetchingContent}
        fetchError={fetchError}
        onCopy={() => {/* parent-level side-effects can be added here */}}
        onPublish={() => {/* parent-level side-effects can be added here */}}
        onRegenerate={onRegenerate}
      />
    </div>
  )
}

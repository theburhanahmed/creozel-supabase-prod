import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CopyIcon, CheckIcon, DownloadIcon, SendIcon, RefreshCwIcon, AlertCircleIcon } from 'lucide-react'
import type { ContentJob } from '../../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for OutputActions.
 *
 * Matches the OutputActionsProps interface defined in design.md.
 */
export interface OutputActionsProps {
  /** The active content job. */
  job: ContentJob
  /** Fetched text content for text/video jobs; null when not yet fetched or N/A. */
  textContent: string | null
  /** True while the inline text content is being fetched from result_url. */
  isFetchingContent: boolean
  /** True when the inline text content fetch failed. */
  fetchError: boolean
  /**
   * Called when the user clicks Copy and the clipboard write succeeds.
   * The parent can use this to trigger any additional side-effects.
   */
  onCopy: () => void
  /**
   * Called when the user clicks Publish.
   * Navigation to /calendar is handled internally; this callback lets the
   * parent perform any pre-navigation cleanup if needed.
   */
  onPublish: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Job types that expose the Copy button (Req 11.5). */
const TEXT_JOB_TYPES: ReadonlySet<ContentJob['type']> = new Set(['text', 'video'])

/** Duration (ms) the "Copied!" confirmation is shown before reverting (Req 11.12). */
const COPY_CONFIRM_DURATION_MS = 3000 // 3 s — within the 2–5 s window

// ─── OutputActions ────────────────────────────────────────────────────────────

/**
 * OutputActions
 *
 * Renders the Copy, Download, Publish, and Regenerate action buttons for the
 * Output Panel.
 *
 * Behaviour:
 * - **Copy** (text/video jobs only, Req 11.5, 11.12):
 *   Copies `textContent` to the clipboard via `navigator.clipboard.writeText`.
 *   On success: shows "Copied!" for 2–5 s then reverts to "Copy".
 *   On failure: shows an inline error message.
 * - **Download** (Req 11.6):
 *   Initiates a file download from `job.result_url` using a hidden <a> element.
 * - **Publish** (Req 11.7):
 *   Navigates to `/calendar` with the generated content pre-filled via
 *   React Router `state`.
 * - **Regenerate** (Req 11.10):
 *   Calls `onRegenerate` to reset the active job and re-enable Generate.
 * - All Copy/Download/Publish buttons are disabled when `actionsDisabled` is
 *   true (Req 11.8, 11.11).
 *
 * Requirements: 11.5, 11.6, 11.7, 11.8, 11.10, 11.11, 11.12
 */
export const OutputActions: React.FC<OutputActionsProps & { onRegenerate: () => void }> = ({
  job,
  textContent,
  isFetchingContent,
  fetchError: _fetchError,
  onCopy,
  onPublish,
  onRegenerate,
}) => {
  const navigate = useNavigate()

  // ── Copy state ─────────────────────────────────────────────────────────────
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Derived flags ──────────────────────────────────────────────────────────

  const isCompleted = job.status === 'completed'
  const isTerminal = job.status === 'completed' || job.status === 'failed'

  /**
   * Copy, Download, and Publish are disabled when:
   * - Job status is not `completed` (Req 11.11)
   * - While fetching inline text content (Req 11.8)
   */
  const actionsDisabled = !isCompleted || isFetchingContent

  const showCopyButton = TEXT_JOB_TYPES.has(job.type)

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    if (actionsDisabled || !textContent) return

    // Clear any pending revert timer
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }

    try {
      await navigator.clipboard.writeText(textContent)
      setCopyState('copied')
      onCopy()
      // Revert to idle after COPY_CONFIRM_DURATION_MS (Req 11.12)
      copyTimerRef.current = setTimeout(() => {
        setCopyState('idle')
        copyTimerRef.current = null
      }, COPY_CONFIRM_DURATION_MS)
    } catch {
      setCopyState('error')
    }
  }

  const handleDownload = () => {
    if (actionsDisabled || !job.result_url) return

    // Derive a filename from the URL or fall back to a generic name
    const urlParts = job.result_url.split('/')
    const filename = urlParts[urlParts.length - 1] || `content-${job.id}`

    const anchor = document.createElement('a')
    anchor.href = job.result_url
    anchor.download = filename
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  const handlePublish = () => {
    if (actionsDisabled) return

    onPublish()

    // Navigate to /calendar with content pre-filled (Req 11.7)
    navigate('/calendar', {
      state: {
        prefillContent: textContent ?? undefined,
        prefillResultUrl: job.result_url ?? undefined,
        prefillJobId: job.id,
        prefillJobType: job.type,
      },
    })
  }

  // ── Shared button class helpers ────────────────────────────────────────────

  const secondaryBtnClass = (disabled: boolean) =>
    [
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
      disabled
        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
    ].join(' ')

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {/* ── Inline copy error (Req 11.12) ──────────────────────────────────── */}
      {copyState === 'error' && (
        <div
          className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircleIcon size={12} aria-hidden="true" />
          <span>Failed to copy to clipboard. Please try again.</span>
        </div>
      )}

      {/* ── Action buttons row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">

        {/* Copy button — text/video jobs only (Req 11.5, 11.12) */}
        {showCopyButton && (
          <button
            type="button"
            onClick={handleCopy}
            disabled={actionsDisabled || !textContent}
            aria-disabled={actionsDisabled || !textContent}
            className={secondaryBtnClass(actionsDisabled || !textContent)}
            aria-label={
              copyState === 'copied'
                ? 'Content copied to clipboard'
                : 'Copy generated content to clipboard'
            }
          >
            {copyState === 'copied' ? (
              <>
                <CheckIcon size={12} aria-hidden="true" className="text-green-500" />
                <span className="text-green-600 dark:text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <CopyIcon size={12} aria-hidden="true" />
                Copy
              </>
            )}
          </button>
        )}

        {/* Download button — all completed jobs (Req 11.6) */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={actionsDisabled || !job.result_url}
          aria-disabled={actionsDisabled || !job.result_url}
          className={secondaryBtnClass(actionsDisabled || !job.result_url)}
          aria-label="Download generated content"
        >
          <DownloadIcon size={12} aria-hidden="true" />
          Download
        </button>

        {/* Publish button — all completed jobs (Req 11.7) */}
        <button
          type="button"
          onClick={handlePublish}
          disabled={actionsDisabled}
          aria-disabled={actionsDisabled}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            actionsDisabled
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700',
          ].join(' ')}
          aria-label="Publish generated content to Calendar"
        >
          <SendIcon size={12} aria-hidden="true" />
          Publish
        </button>

        {/* Regenerate button — shown at terminal status (Req 11.10) */}
        {isTerminal && (
          <button
            type="button"
            onClick={onRegenerate}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Regenerate with the same configuration"
          >
            <RefreshCwIcon size={13} aria-hidden="true" />
            Regenerate
          </button>
        )}
      </div>
    </div>
  )
}

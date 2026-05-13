import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ClockIcon, Loader2Icon } from 'lucide-react'
import { RecentJobCard } from './RecentJobCard'
import { getRecentJobs } from '../../../services/contentService'
import { supabase } from '../../../lib/supabase'
import type { ContentJob } from '../../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for RecentJobsPanel.
 *
 * The component is self-contained: it fetches its own data using `teamId` and
 * `userId`, manages loading/error state internally, and subscribes to Realtime
 * updates so the list refreshes automatically when a job completes or is
 * cancelled.
 *
 * The `onSelectJob` and `onReuseConfig` callbacks are forwarded to each
 * `RecentJobCard` child, matching the RecentJobsPanelProps interface in
 * design.md.
 */
export interface RecentJobsPanelProps {
  /** The active team ID — used to filter jobs and scope the Realtime channel. */
  teamId: string
  /** The current user ID — required by getRecentJobs. */
  userId: string
  /** Called when the user clicks a job card to load its result into the Output Panel. */
  onSelectJob: (job: ContentJob) => void
  /** Called when the user clicks "Re-use Config" on a completed job card. */
  onReuseConfig: (job: ContentJob) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of recent jobs to fetch and display (Requirement 13.5). */
const RECENT_JOBS_LIMIT = 10

/**
 * Job statuses that should trigger a list refresh via the Realtime subscription.
 * We refresh when a job reaches a terminal state (completed or cancelled) so
 * the panel stays in sync with the active job's final status.
 *
 * Requirement 13.5: "refreshes automatically when a new job completes or is
 * cancelled via the existing Realtime subscription".
 */
const REFRESH_TRIGGER_STATUSES: ReadonlySet<string> = new Set([
  'completed',
  'cancelled',
  'failed',
])

// ─── RecentJobsPanel ──────────────────────────────────────────────────────────

/**
 * RecentJobsPanel
 *
 * Displays the last 10 content jobs for the active team. Manages its own
 * fetch lifecycle and subscribes to Supabase Realtime to refresh the list
 * whenever a job transitions to `completed`, `cancelled`, or `failed`.
 *
 * States:
 * - Loading: spinner while the initial fetch (or a refresh) is in progress.
 * - Error: "Failed to load recent jobs" message when the fetch throws.
 * - Empty: friendly empty state when no jobs exist for the team.
 * - Populated: scrollable list of `RecentJobCard` components.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */
export const RecentJobsPanel: React.FC<RecentJobsPanelProps> = ({
  teamId,
  userId,
  onSelectJob,
  onReuseConfig,
}) => {
  // ── State ──────────────────────────────────────────────────────────────────

  const [jobs, setJobs] = useState<ContentJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Keep a stable ref to the latest fetch function so the Realtime callback
  // can call it without needing to be re-registered on every render.
  const fetchJobsRef = useRef<() => Promise<void>>(null!)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)

    try {
      const result = await getRecentJobs(userId, RECENT_JOBS_LIMIT, teamId)
      setJobs(result)
    } catch {
      // getRecentJobs already calls reportError internally; we just surface
      // the error state to the UI here.
      setHasError(true)
      setJobs([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, teamId])

  // Keep the ref in sync with the latest fetchJobs closure.
  fetchJobsRef.current = fetchJobs

  // ── Initial fetch ──────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchJobs()
  }, [fetchJobs])

  // ── Realtime subscription ──────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) return

    /**
     * Subscribe to UPDATE events on content_jobs filtered by team_id.
     * When a job transitions to a terminal status (completed, cancelled, failed),
     * re-fetch the list so the panel reflects the latest state.
     *
     * Requirement 13.5: "refreshes automatically when a new job completes or is
     * cancelled via the existing Realtime subscription".
     */
    const channel = supabase
      .channel(`recent-jobs:team:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'content_jobs',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          const updatedJob = payload.new as ContentJob
          if (REFRESH_TRIGGER_STATUSES.has(updatedJob.status)) {
            void fetchJobsRef.current()
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content_jobs',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          // Refresh on new job insert so the panel shows the job immediately
          // (it will appear in pending state and update via the UPDATE listener).
          void fetchJobsRef.current()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [teamId])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Recent jobs"
      className="flex flex-col gap-3"
    >
      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClockIcon
            size={15}
            className="text-gray-400 dark:text-gray-500 shrink-0"
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Recent Jobs
          </h3>
        </div>

        {/* Subtle loading indicator for background refreshes */}
        {isLoading && jobs.length > 0 && (
          <Loader2Icon
            size={13}
            className="animate-spin text-gray-400 dark:text-gray-500 shrink-0"
            aria-hidden="true"
            aria-label="Refreshing recent jobs"
          />
        )}
      </div>

      {/* ── Loading state (initial fetch only) ───────────────────────────── */}
      {isLoading && jobs.length === 0 && (
        <div
          className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400 dark:text-gray-500"
          aria-live="polite"
          aria-label="Loading recent jobs"
        >
          <Loader2Icon size={16} className="animate-spin shrink-0" aria-hidden="true" />
          <span>Loading recent jobs…</span>
        </div>
      )}

      {/* ── Error state (Requirement 13.5) ────────────────────────────────── */}
      {hasError && !isLoading && (
        <div
          className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-center"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Failed to load recent jobs
          </p>
          <button
            type="button"
            onClick={() => void fetchJobs()}
            className={[
              'mt-2 text-xs font-medium',
              'text-red-600 dark:text-red-400',
              'underline underline-offset-2',
              'hover:text-red-800 dark:hover:text-red-300',
              'outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5]',
              'transition-colors duration-150',
            ].join(' ')}
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!isLoading && !hasError && jobs.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-8 text-center"
          aria-label="No recent jobs"
        >
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
            <ClockIcon
              size={18}
              className="text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            No recent jobs
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Generated content will appear here.
          </p>
        </div>
      )}

      {/* ── Job list ──────────────────────────────────────────────────────── */}
      {!hasError && jobs.length > 0 && (
        <ul
          className="flex flex-col gap-2"
          aria-label={`${jobs.length} recent job${jobs.length === 1 ? '' : 's'}`}
        >
          {jobs.map((job) => (
            <li key={job.id}>
              <RecentJobCard
                job={job}
                onSelect={() => onSelectJob(job)}
                onReuseConfig={() => onReuseConfig(job)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

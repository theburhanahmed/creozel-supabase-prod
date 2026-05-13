import React from 'react'
import { Loader2Icon } from 'lucide-react'
import { StatusBadge } from '../StatusBadge'
import type { ContentJob } from '../../../types'

/**
 * Props for JobStatusDisplay.
 *
 * Matches the interface defined in design.md §Props Interfaces (OutputPanel section).
 */
export interface JobStatusDisplayProps {
  /** The active content job, or null when no job is active. */
  job: ContentJob | null
}

/**
 * Statuses that indicate the job is still in progress.
 * A progress indicator is shown for these states (Requirements 10.4, 11.1).
 */
const IN_PROGRESS_STATUSES: ReadonlySet<ContentJob['status']> = new Set([
  'pending',
  'running',
])

/**
 * JobStatusDisplay
 *
 * Renders the current job status in the Output Panel header area.
 *
 * Behaviour:
 * - When `job` is null: renders nothing (empty fragment).
 * - Always renders a `StatusBadge` for the current job status
 *   (pending, running, completed, failed, cancelled) — Requirement 11.1.
 * - While status is `pending` or `running`: renders an animated spinner
 *   progress indicator alongside the badge — Requirement 10.4.
 * - The spinner is hidden from assistive technologies (aria-hidden) because
 *   the StatusBadge already communicates the status via its aria-label.
 *
 * Requirements: 10.4, 11.1, 15.1, 15.2
 */
export const JobStatusDisplay: React.FC<JobStatusDisplayProps> = ({ job }) => {
  if (!job) return null

  const isInProgress = IN_PROGRESS_STATUSES.has(job.status)

  return (
    <div
      className="flex items-center gap-2"
      aria-label={`Job status: ${job.status}`}
    >
      {/* Progress spinner — visible only while pending or running (Req 10.4) */}
      {isInProgress && (
        <Loader2Icon
          size={15}
          aria-hidden="true"
          className="shrink-0 animate-spin text-blue-500 dark:text-blue-400"
        />
      )}

      {/* Status badge — always rendered when a job is active (Req 11.1) */}
      <StatusBadge status={job.status} />
    </div>
  )
}

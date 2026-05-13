import { useEffect } from 'react'
import { subscribeToJob } from '../services/contentService'
import type { ContentJob } from '../types'

/**
 * Subscribes to real-time updates for a specific content job.
 * Wraps subscribeToJob from contentService in a useEffect that depends on jobId.
 * Calls unsubscribe in the cleanup function.
 * No-ops when jobId is null.
 */
export function useJobRealtime(
  jobId: string | null,
  onUpdate: (job: ContentJob) => void,
): void {
  useEffect(() => {
    if (jobId === null) return

    const unsubscribe = subscribeToJob(jobId, onUpdate)

    return () => {
      unsubscribe()
    }
  }, [jobId, onUpdate])
}

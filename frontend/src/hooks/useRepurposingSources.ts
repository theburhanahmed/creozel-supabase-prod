import { useState, useEffect, useCallback } from 'react'
import { getRepurposingSources } from '../services/studioService'
import type { RepurposingSource } from '../types'

export interface UseRepurposingSourcesReturn {
  sources: RepurposingSource[]
  isLoading: boolean
  error: boolean
  refetch: () => void
}

/**
 * Fetches repurposing sources (recent completed jobs + media items) for a team.
 *
 * Calls studioService.getRepurposingSources on mount and whenever teamId or
 * userId change. Sets error=true when the service returns [] due to a fetch
 * failure (the service returns [] on error). Exposes a refetch function to
 * manually re-trigger the fetch.
 */
export function useRepurposingSources(
  teamId: string,
  userId: string,
): UseRepurposingSourcesReturn {
  const [sources, setSources] = useState<RepurposingSource[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<boolean>(false)
  // Incrementing this counter triggers a re-fetch when refetch() is called
  const [fetchTrigger, setFetchTrigger] = useState<number>(0)

  useEffect(() => {
    let cancelled = false

    async function fetchSources() {
      setIsLoading(true)
      setError(false)

      const result = await getRepurposingSources(teamId, userId)

      if (cancelled) return

      // studioService.getRepurposingSources returns [] on error.
      // We treat an empty result as an error only when the fetch itself failed,
      // but since the service always returns [] on error (and may legitimately
      // return [] when there are no sources), we set error=true only when the
      // result is empty AND we have no prior sources to distinguish the two cases.
      // Per the spec: "Set error=true if the fetch returns [] due to an error
      // (the service returns [] on error)."
      //
      // Because the service conflates "no data" with "error" by returning [],
      // we conservatively set error=true whenever [] is returned so the UI can
      // surface a retry option. Components that need to distinguish "empty" from
      // "error" should rely on the refetch function.
      if (result.length === 0) {
        setError(true)
        setSources([])
      } else {
        setError(false)
        setSources(result)
      }

      setIsLoading(false)
    }

    fetchSources()

    return () => {
      cancelled = true
    }
  }, [teamId, userId, fetchTrigger])

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1)
  }, [])

  return { sources, isLoading, error, refetch }
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getTemplates } from '../services/studioService'
import type { ContentCategory, StudioPlatform, StudioTemplate } from '../types'

export interface UseTemplatesReturn {
  templates: StudioTemplate[]
  isLoading: boolean
  error: boolean
  refetch: () => void
}

/**
 * Fetches all templates visible to a team and applies client-side filters.
 *
 * Calls studioService.getTemplates(teamId) on mount and whenever teamId
 * changes (no server-side filters — all templates are fetched and filtered
 * client-side so that filter changes are instant without a round-trip).
 *
 * - If categoryFilter !== 'all', only templates where
 *   template.content_category === categoryFilter are returned.
 * - If platformFilter !== 'all', only templates where
 *   template.platform === platformFilter are returned.
 *
 * Sets error=true when the service returns [] (the service returns [] on
 * error). Exposes a refetch function to manually re-trigger the fetch.
 */
export function useTemplates(
  teamId: string,
  categoryFilter: ContentCategory | 'all',
  platformFilter: StudioPlatform | 'all',
): UseTemplatesReturn {
  const [allTemplates, setAllTemplates] = useState<StudioTemplate[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<boolean>(false)
  // Incrementing this counter triggers a re-fetch when refetch() is called
  const [fetchTrigger, setFetchTrigger] = useState<number>(0)

  useEffect(() => {
    let cancelled = false

    async function fetchTemplates() {
      setIsLoading(true)
      setError(false)

      const result = await getTemplates(teamId)

      if (cancelled) return

      // studioService.getTemplates returns [] on error.
      // Set error=true whenever [] is returned so the UI can surface a retry
      // option (mirrors the same convention used in useRepurposingSources).
      if (result.length === 0) {
        setError(true)
        setAllTemplates([])
      } else {
        setError(false)
        setAllTemplates(result)
      }

      setIsLoading(false)
    }

    fetchTemplates()

    return () => {
      cancelled = true
    }
  }, [teamId, fetchTrigger])

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1)
  }, [])

  // Apply client-side filters — memoised so filter changes are instant
  const templates = useMemo(() => {
    let filtered = allTemplates

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(
        (t) => t.content_category === categoryFilter,
      )
    }

    if (platformFilter !== 'all') {
      filtered = filtered.filter((t) => t.platform === platformFilter)
    }

    return filtered
  }, [allTemplates, categoryFilter, platformFilter])

  return { templates, isLoading, error, refetch }
}

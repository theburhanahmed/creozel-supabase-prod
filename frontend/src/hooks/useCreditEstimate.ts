import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ContentCategory, ContentFormat, ContentFormatMetadataSchema, ContentType } from '../types'

/**
 * Maps a ContentCategory to the legacy ContentType used in the pricing_config table.
 * 'story' maps to 'text' since story content is priced as text generation.
 */
function mapCategoryToLegacyType(category: ContentCategory): ContentType {
  const mapping: Record<ContentCategory, ContentType> = {
    text: 'text',
    image: 'image',
    video: 'video',
    audio: 'audio',
    story: 'text',
  }
  return mapping[category]
}

/** Rejects after `ms` milliseconds with a timeout sentinel. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ])
}

export interface UseCreditEstimateReturn {
  estimatedCost: number | null
  isLoading: boolean
  isUnavailable: boolean
}

/**
 * Debounced credit cost estimation hook.
 *
 * Queries the pricing_config table for the credit cost of the given
 * ContentCategory (mapped to legacy ContentType). Debounces the fetch by
 * 400 ms and applies a 5-second timeout. On fetch failure or timeout,
 * sets isUnavailable=true and estimatedCost=null.
 */
export function useCreditEstimate(
  category: ContentCategory,
  _format: ContentFormat,
  _advancedOptions: ContentFormatMetadataSchema['advancedOptions'],
): UseCreditEstimateReturn {
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false)

  // Ref to hold the debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Incremented on each new fetch to detect stale responses
  const fetchIdRef = useRef<number>(0)

  useEffect(() => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }

    setIsLoading(true)
    setIsUnavailable(false)

    // Capture the fetch ID for this effect run
    const currentFetchId = ++fetchIdRef.current

    debounceTimerRef.current = setTimeout(() => {
      const legacyType = mapCategoryToLegacyType(category)

      const fetchPromise = Promise.resolve(
        supabase
          .from('pricing_config')
          .select('credits_cost')
          .eq('content_type', legacyType)
          .eq('is_active', true)
          .maybeSingle(),
      )

      withTimeout(fetchPromise, 5000)
        .then((result) => {
          // Ignore stale responses from a previous category
          if (fetchIdRef.current !== currentFetchId) return

          const { data, error } = result as {
            data: { credits_cost: number } | null
            error: { message: string } | null
          }

          if (error) {
            setEstimatedCost(null)
            setIsUnavailable(true)
          } else {
            setEstimatedCost(data?.credits_cost ?? null)
            setIsUnavailable(data === null)
          }
          setIsLoading(false)
        })
        .catch(() => {
          // Ignore stale responses
          if (fetchIdRef.current !== currentFetchId) return

          // Covers both network errors and the 5-second timeout
          setEstimatedCost(null)
          setIsUnavailable(true)
          setIsLoading(false)
        })
    }, 400)

    return () => {
      // The next effect run already incremented fetchIdRef.current, so any
      // in-flight response for the previous currentFetchId will be ignored.
      // Only clear the pending debounce timer here.
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [category])

  return { estimatedCost, isLoading, isUnavailable }
}

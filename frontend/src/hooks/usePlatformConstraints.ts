import { useMemo } from 'react'
import { CONTENT_FORMAT_REGISTRY } from '../constants/contentFormatRegistry'
import type { ContentFormat, StudioPlatform, PlatformConstraints } from '../types'

/**
 * Returns the PlatformConstraints for a given format + platform combination
 * from CONTENT_FORMAT_REGISTRY, or null if no constraints are defined for
 * that combination. Memoised with useMemo.
 */
export function usePlatformConstraints(
  format: ContentFormat,
  platform: StudioPlatform,
): PlatformConstraints | null {
  return useMemo(() => {
    return CONTENT_FORMAT_REGISTRY[format].constraints[platform] ?? null
  }, [format, platform])
}

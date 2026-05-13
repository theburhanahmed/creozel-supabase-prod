import { useMemo } from 'react'
import {
  CONTENT_FORMAT_REGISTRY,
  CONTENT_FORMATS_PHASE1,
} from '../constants/contentFormatRegistry'
import type {
  ContentCategory,
  ContentFormat,
  ContentFormatRegistryEntry,
} from '../types'

/**
 * Returns an array of [ContentFormat, ContentFormatRegistryEntry] pairs for
 * the given category, filtered from CONTENT_FORMATS_PHASE1 and sorted
 * alphabetically by entry label. Memoised with useMemo.
 */
export function useContentFormats(
  category: ContentCategory,
): [ContentFormat, ContentFormatRegistryEntry][] {
  return useMemo(() => {
    return CONTENT_FORMATS_PHASE1
      .filter((format) => CONTENT_FORMAT_REGISTRY[format].category === category)
      .map((format): [ContentFormat, ContentFormatRegistryEntry] => [
        format,
        CONTENT_FORMAT_REGISTRY[format],
      ])
      .sort(([, a], [, b]) => a.label.localeCompare(b.label))
  }, [category])
}

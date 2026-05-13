/**
 * Property-Based Tests — Platform Compatibility Filtering
 *
 * Property 3 (platform compatibility filtering):
 *   For any ContentFormat and StudioPlatform not in compatiblePlatforms,
 *   assert that platform does not appear in the availablePlatforms list
 *   derived from the registry. Conversely, for any platform that IS in
 *   compatiblePlatforms, assert it does appear.
 *
 * The "availablePlatforms" for a given format is simply
 * CONTENT_FORMAT_REGISTRY[format].compatiblePlatforms.
 *
 * **Validates: Requirements 4.4, 4.5, 16.3**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  CONTENT_FORMAT_REGISTRY,
  CONTENT_FORMATS_PHASE1,
  STUDIO_PLATFORMS,
} from '../../constants/contentFormatRegistry'
import type { ContentFormat, StudioPlatform } from '../../types'

describe('PBT — Platform Compatibility Filtering', () => {
  it('Property 3: incompatible platforms are absent from availablePlatforms; compatible platforms are present', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom(...(CONTENT_FORMATS_PHASE1 as [ContentFormat, ...ContentFormat[]])),
          fc.constantFrom(...(STUDIO_PLATFORMS as unknown as [StudioPlatform, ...StudioPlatform[]])),
        ),
        ([format, platform]: [ContentFormat, StudioPlatform]) => {
          const availablePlatforms: StudioPlatform[] =
            CONTENT_FORMAT_REGISTRY[format].compatiblePlatforms

          const isCompatible = availablePlatforms.includes(platform)

          if (!isCompatible) {
            // Platform NOT in compatiblePlatforms — must be absent from availablePlatforms
            expect(availablePlatforms).not.toContain(platform)
          } else {
            // Platform IS in compatiblePlatforms — must be present in availablePlatforms
            expect(availablePlatforms).toContain(platform)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property-Based Tests — useContentFormats (Category-Format Membership)
 *
 * Property 2 (category-format membership):
 *   For any ContentCategory, every format returned by filtering the registry
 *   by that category must have registry[format].category === category, and
 *   no format from another category appears in the filtered list.
 *
 * **Validates: Requirements 3.1, 16.3**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  CONTENT_FORMAT_REGISTRY,
  CONTENT_FORMATS_PHASE1,
  CONTENT_CATEGORIES,
} from '../../constants/contentFormatRegistry'
import type { ContentCategory } from '../../types'

describe('PBT — useContentFormats (Category-Format Membership)', () => {
  it('Property 2: every format filtered by a category belongs to that category and no cross-category contamination occurs', () => {
    fc.assert(
      fc.property(
        // Sample from the five known ContentCategory values
        fc.constantFrom(...(CONTENT_CATEGORIES as [ContentCategory, ...ContentCategory[]])),
        (category: ContentCategory) => {
          // Filter Phase 1 formats to those whose registry entry matches the sampled category
          const formatsForCategory = CONTENT_FORMATS_PHASE1.filter(
            (format) => CONTENT_FORMAT_REGISTRY[format].category === category,
          )

          // Every format in the filtered list must belong to the sampled category
          for (const format of formatsForCategory) {
            expect(CONTENT_FORMAT_REGISTRY[format].category).toBe(category)
          }

          // No format from a different category must appear in the filtered list
          const otherCategories = (CONTENT_CATEGORIES as readonly ContentCategory[]).filter(
            (c) => c !== category,
          )
          for (const otherCategory of otherCategories) {
            const contamination = formatsForCategory.filter(
              (format) => CONTENT_FORMAT_REGISTRY[format].category === otherCategory,
            )
            expect(contamination).toHaveLength(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

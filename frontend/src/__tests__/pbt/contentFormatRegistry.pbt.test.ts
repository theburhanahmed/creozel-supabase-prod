/**
 * Property-Based Tests — Content Format Registry
 *
 * Property 1 (registry completeness):
 *   For every ContentFormat key in CONTENT_FORMATS_PHASE1, assert that
 *   CONTENT_FORMAT_REGISTRY has a non-null entry with:
 *     - non-empty label
 *     - non-empty description
 *     - valid category (one of the five ContentCategory values)
 *     - non-empty compatiblePlatforms array
 *
 * **Validates: Requirements 3.2, 16.1, 16.2**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  CONTENT_FORMAT_REGISTRY,
  CONTENT_FORMATS_PHASE1,
  CONTENT_CATEGORIES,
} from '../../constants/contentFormatRegistry'
import type { ContentFormat, ContentCategory } from '../../types'

const VALID_CATEGORIES = new Set<ContentCategory>(CONTENT_CATEGORIES)

describe('PBT — Content Format Registry', () => {
  it('Property 1: every ContentFormat key has a complete, valid registry entry', () => {
    fc.assert(
      fc.property(
        // Use fc.constantFrom to iterate over all Phase 1 format keys.
        // fast-check will sample from this set across all runs.
        fc.constantFrom(...(CONTENT_FORMATS_PHASE1 as [ContentFormat, ...ContentFormat[]])),
        (format: ContentFormat) => {
          const entry = CONTENT_FORMAT_REGISTRY[format]

          // Entry must exist (non-null / non-undefined)
          expect(entry).toBeDefined()
          expect(entry).not.toBeNull()

          // label must be a non-empty string
          expect(typeof entry.label).toBe('string')
          expect(entry.label.trim().length).toBeGreaterThan(0)

          // description must be a non-empty string
          expect(typeof entry.description).toBe('string')
          expect(entry.description.trim().length).toBeGreaterThan(0)

          // category must be one of the five valid ContentCategory values
          expect(VALID_CATEGORIES.has(entry.category)).toBe(true)

          // compatiblePlatforms must be a non-empty array
          expect(Array.isArray(entry.compatiblePlatforms)).toBe(true)
          expect(entry.compatiblePlatforms.length).toBeGreaterThan(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})

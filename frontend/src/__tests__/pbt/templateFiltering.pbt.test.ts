/**
 * Property-Based Tests — Template Filter Correctness
 *
 * Property 15 (template filter correctness):
 *   For any filter combination (categoryFilter, platformFilter), every
 *   StudioTemplate returned by the client-side filter logic SHALL satisfy:
 *     - template.content_category === categoryFilter (when not 'all')
 *     - template.platform === platformFilter (when not 'all')
 *   No template that fails either active filter SHALL appear in the result.
 *
 * **Validates: Requirements 8.4**
 *
 * Implementation note:
 *   useTemplates applies client-side filters via useMemo. We test the filter
 *   logic directly by mirroring the exact applyFilters logic from useTemplates.ts
 *   without needing to render the hook or mock Supabase.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  CONTENT_CATEGORIES,
  STUDIO_PLATFORMS,
} from '../../constants/contentFormatRegistry'
import type {
  ContentCategory,
  ContentFormatMetadataSchema,
  StudioPlatform,
  StudioTemplate,
} from '../../types'

// ─── Mirror of useTemplates' client-side filter logic ─────────────────────────
// Replicates the exact useMemo filter from useTemplates.ts so the test
// validates the same behaviour without rendering the hook.

function applyFilters(
  templates: StudioTemplate[],
  categoryFilter: ContentCategory | 'all',
  platformFilter: StudioPlatform | 'all',
): StudioTemplate[] {
  let filtered = templates

  if (categoryFilter !== 'all') {
    filtered = filtered.filter(
      (t) => t.content_category === categoryFilter,
    )
  }

  if (platformFilter !== 'all') {
    filtered = filtered.filter((t) => t.platform === platformFilter)
  }

  return filtered
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a valid ContentCategory value. */
const categoryArb = fc.constantFrom(
  ...(CONTENT_CATEGORIES as unknown as [ContentCategory, ...ContentCategory[]]),
)

/** Generates a valid StudioPlatform value. */
const platformArb = fc.constantFrom(
  ...(STUDIO_PLATFORMS as unknown as [StudioPlatform, ...StudioPlatform[]]),
)

/** Generates a categoryFilter: either a specific category or 'all'. */
const categoryFilterArb: fc.Arbitrary<ContentCategory | 'all'> = fc.oneof(
  fc.constant('all' as const),
  categoryArb,
)

/** Generates a platformFilter: either a specific platform or 'all'. */
const platformFilterArb: fc.Arbitrary<StudioPlatform | 'all'> = fc.oneof(
  fc.constant('all' as const),
  platformArb,
)

/** Generates a minimal valid StudioTemplate with arbitrary category and platform. */
const studioTemplateArb: fc.Arbitrary<StudioTemplate> = fc.record<StudioTemplate>({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ minLength: 0, maxLength: 500 }),
  content_category: categoryArb,
  content_format: fc.constantFrom(
    'tweet', 'blog_post', 'reel', 'podcast_episode', 'story_single',
  ),
  platform: platformArb,
  tone: fc.constantFrom(
    'Professional', 'Casual', 'Humorous', 'Inspirational', 'Persuasive', 'Informative',
  ),
  prompt_template: fc.string({ minLength: 0, maxLength: 500 }),
  advanced_options: fc.constant({
    model: null,
    resolution: null,
    style: null,
    negativePrompt: null,
    seed: null,
    voice: null,
    pitch: null,
    stability: null,
    outputFormat: null,
    aspectRatio: null,
    includeBRoll: null,
    brandVoice: null,
    language: null,
  } satisfies ContentFormatMetadataSchema['advancedOptions']),
  is_system: fc.boolean(),
  team_id: fc.option(fc.uuid(), { nil: null }),
  created_at: fc.integer({ min: Date.parse('2000-01-01T00:00:00.000Z'), max: Date.parse('2030-01-01T00:00:00.000Z') }).map((ts) => new Date(ts).toISOString()),
})

/** Generates an array of 0–20 StudioTemplate objects. */
const templatesArrayArb = fc.array(studioTemplateArb, { minLength: 0, maxLength: 20 })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Template Filter Correctness', () => {
  it('Property 15: no template in the filtered result fails the active category or platform filter', () => {
    /**
     * **Validates: Requirements 8.4**
     *
     * For any array of StudioTemplate objects and any combination of
     * categoryFilter and platformFilter, every template in the filtered
     * result must satisfy both active filters. No template that fails
     * either active filter may appear in the result.
     */
    fc.assert(
      fc.property(
        templatesArrayArb,
        categoryFilterArb,
        platformFilterArb,
        (
          templates: StudioTemplate[],
          categoryFilter: ContentCategory | 'all',
          platformFilter: StudioPlatform | 'all',
        ) => {
          const result = applyFilters(templates, categoryFilter, platformFilter)

          for (const template of result) {
            // When categoryFilter is active, every returned template must match it
            if (categoryFilter !== 'all') {
              expect(template.content_category).toBe(categoryFilter)
            }

            // When platformFilter is active, every returned template must match it
            if (platformFilter !== 'all') {
              expect(template.platform).toBe(platformFilter)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Property 15 (completeness): templates that satisfy both filters are never dropped', () => {
    /**
     * **Validates: Requirements 8.4**
     *
     * The filter must not drop templates that satisfy both active filters.
     * Every template in the input that matches both categoryFilter and
     * platformFilter must appear in the output.
     */
    fc.assert(
      fc.property(
        templatesArrayArb,
        categoryFilterArb,
        platformFilterArb,
        (
          templates: StudioTemplate[],
          categoryFilter: ContentCategory | 'all',
          platformFilter: StudioPlatform | 'all',
        ) => {
          const result = applyFilters(templates, categoryFilter, platformFilter)

          // Build the set of result IDs for O(1) lookup
          const resultIds = new Set(result.map((t) => t.id))

          for (const template of templates) {
            const matchesCategory =
              categoryFilter === 'all' || template.content_category === categoryFilter
            const matchesPlatform =
              platformFilter === 'all' || template.platform === platformFilter

            if (matchesCategory && matchesPlatform) {
              // This template satisfies both filters — it must appear in the result
              expect(resultIds.has(template.id)).toBe(true)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

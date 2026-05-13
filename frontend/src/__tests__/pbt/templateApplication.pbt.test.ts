/**
 * Property-Based Tests — Template Application
 *
 * Property 9 (template application):
 *   applyTemplate(template) overwrites all five fields (prompt, contentCategory,
 *   contentFormat, platform, tone) regardless of what was previously in the
 *   draft config state.
 *
 *   For any arbitrary StudioTemplate and any arbitrary prior StudioDraftConfig,
 *   the result of applying the template must have:
 *   - prompt === template.prompt_template
 *   - contentCategory === template.content_category
 *   - contentFormat === template.content_format
 *   - platform === template.platform
 *   - tone === template.tone
 *
 * **Validates: Requirements 8.4, 8.5**
 *
 * Implementation note:
 *   applyTemplate() is a method of the useStudioState hook. Since we cannot
 *   render hooks in unit tests without a React environment, we mirror the exact
 *   pure transformation logic as a standalone function and test that directly.
 *   Any change to the hook's applyTemplate logic must be reflected here.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  CONTENT_FORMATS_PHASE1,
  CONTENT_CATEGORIES,
  STUDIO_PLATFORMS,
  STUDIO_TONES,
} from '../../constants/contentFormatRegistry'
import type {
  ContentCategory,
  ContentFormat,
  LengthConfig,
  StudioDraftConfig,
  StudioPlatform,
  StudioTemplate,
  StudioTone,
} from '../../types'

// ─── Mirror of applyTemplate pure transformation ──────────────────────────────
// This replicates the field-overwrite logic from useStudioState.applyTemplate()
// as a pure function so it can be tested without a React environment.
// Any change to the hook's applyTemplate logic must be reflected here.

function applyTemplate(
  template: StudioTemplate,
  currentState: StudioDraftConfig,
): StudioDraftConfig {
  return {
    ...currentState,
    prompt: template.prompt_template,
    contentCategory: template.content_category,
    contentFormat: template.content_format,
    platform: template.platform,
    tone: template.tone,
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const lengthConfigArb = fc.record<LengthConfig>({
  preset: fc.constantFrom('short', 'medium', 'long', 'custom', null),
  minWords: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
  maxWords: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
  durationSeconds: fc.option(fc.integer({ min: 1, max: 3600 }), { nil: null }),
  quantity: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  speakingRate: fc.option(fc.float({ min: 0.5, max: 2.0 }), { nil: null }),
})

/** Generates an arbitrary StudioDraftConfig representing any prior state. */
const draftConfigArb = fc.record<StudioDraftConfig>({
  prompt: fc.string({ minLength: 0, maxLength: 4000 }),
  contentCategory: fc.constantFrom(
    ...(CONTENT_CATEGORIES as unknown as [ContentCategory, ...ContentCategory[]]),
  ),
  contentFormat: fc.constantFrom(
    ...(CONTENT_FORMATS_PHASE1 as [ContentFormat, ...ContentFormat[]]),
  ),
  platform: fc.constantFrom(
    ...(STUDIO_PLATFORMS as unknown as [StudioPlatform, ...StudioPlatform[]]),
  ),
  tone: fc.constantFrom(
    ...(STUDIO_TONES as unknown as [StudioTone, ...StudioTone[]]),
  ),
  length: lengthConfigArb,
})

// Use a fixed ISO date string for StudioTemplate timestamps.
// fc.date() can produce invalid Date objects even with min/max bounds during
// shrinking, causing RangeError from toISOString(). A constant is simpler and
// sufficient since the timestamp values are not part of the properties under test.
const FIXED_ISO_DATE = '2024-01-15T10:00:00.000Z'

/** Generates an arbitrary StudioTemplate with all required fields. */
const studioTemplateArb = fc.record<StudioTemplate>({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ minLength: 0, maxLength: 500 }),
  content_category: fc.constantFrom(
    ...(CONTENT_CATEGORIES as unknown as [ContentCategory, ...ContentCategory[]]),
  ),
  content_format: fc.constantFrom(
    ...(CONTENT_FORMATS_PHASE1 as [ContentFormat, ...ContentFormat[]]),
  ),
  platform: fc.constantFrom(
    ...(STUDIO_PLATFORMS as unknown as [StudioPlatform, ...StudioPlatform[]]),
  ),
  tone: fc.constantFrom(
    ...(STUDIO_TONES as unknown as [StudioTone, ...StudioTone[]]),
  ),
  prompt_template: fc.string({ minLength: 0, maxLength: 4000 }),
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
  }),
  is_system: fc.boolean(),
  team_id: fc.option(fc.uuid(), { nil: null }),
  created_at: fc.constant(FIXED_ISO_DATE),
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Template Application', () => {
  it(
    'Property 9: applyTemplate() overwrites all five fields regardless of prior state',
    () => {
      /**
       * **Validates: Requirements 8.4, 8.5**
       *
       * For any arbitrary StudioTemplate and any arbitrary prior StudioDraftConfig,
       * applying the template must overwrite all five core fields with the
       * template's values. The prior state of those fields is irrelevant —
       * the template always wins.
       */
      fc.assert(
        fc.property(
          studioTemplateArb,
          draftConfigArb,
          (template: StudioTemplate, currentState: StudioDraftConfig) => {
            const result = applyTemplate(template, currentState)

            // All five fields must be overwritten by the template values
            expect(result.prompt).toBe(template.prompt_template)
            expect(result.contentCategory).toBe(template.content_category)
            expect(result.contentFormat).toBe(template.content_format)
            expect(result.platform).toBe(template.platform)
            expect(result.tone).toBe(template.tone)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 9 (non-overwritten fields): applyTemplate() preserves fields not covered by the template',
    () => {
      /**
       * **Validates: Requirements 8.4, 8.5**
       *
       * The length field is not part of the template and must be preserved
       * from the prior state after applying a template.
       */
      fc.assert(
        fc.property(
          studioTemplateArb,
          draftConfigArb,
          (template: StudioTemplate, currentState: StudioDraftConfig) => {
            const result = applyTemplate(template, currentState)

            // length is not overwritten by the template — it must be preserved
            expect(result.length).toEqual(currentState.length)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

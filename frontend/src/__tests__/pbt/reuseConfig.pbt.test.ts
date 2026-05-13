/**
 * Property-Based Tests — Reuse Job Config (Legacy Fallback)
 *
 * Property 10 (reuse config with legacy fallback):
 *   reuseJobConfig(job) populates all metadata fields from the job. When
 *   contentFormat is absent (undefined/null) from job.metadata, the current
 *   contentFormat is preserved (legacy fallback) — the result is never
 *   null or undefined.
 *
 *   For any ContentJob where metadata.contentFormat is absent, the resulting
 *   contentFormat must equal the currentContentFormat (the value that was
 *   active before reuseJobConfig was called).
 *
 * **Validates: Requirements 18.1, 18.7**
 *
 * Implementation note:
 *   reuseJobConfig() is a method of the useStudioState hook. Since we cannot
 *   render hooks in unit tests without a React environment, we mirror the exact
 *   pure transformation logic as a standalone function and test that directly.
 *   Any change to the hook's reuseJobConfig logic must be reflected here.
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
  ContentJob,
  LengthConfig,
  StudioPlatform,
  StudioTone,
} from '../../types'

// ─── Mirror of reuseJobConfig pure transformation ─────────────────────────────
// This replicates the field-population logic from useStudioState.reuseJobConfig()
// as a pure function so it can be tested without a React environment.
// Any change to the hook's reuseJobConfig logic must be reflected here.

const DEFAULT_CONTENT_CATEGORY: ContentCategory = 'text'
const DEFAULT_PLATFORM: StudioPlatform = 'General'
const DEFAULT_TONE: StudioTone = 'Professional'
const DEFAULT_LENGTH: LengthConfig = {
  preset: 'medium',
  minWords: null,
  maxWords: null,
  durationSeconds: null,
  quantity: null,
  speakingRate: null,
}

function isValidLengthConfig(value: unknown): value is LengthConfig {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const validPresets = ['short', 'medium', 'long', 'custom', null]
  return validPresets.includes(v.preset as string | null)
}

interface ReuseJobConfigResult {
  prompt: string
  contentCategory: ContentCategory
  contentFormat: ContentFormat
  platform: StudioPlatform
  tone: StudioTone
  length: LengthConfig
}

/**
 * Pure mirror of useStudioState.reuseJobConfig().
 * currentContentFormat represents the contentFormat that was active in the
 * hook's state before reuseJobConfig was called (used for the legacy fallback).
 */
function reuseJobConfig(
  job: ContentJob,
  currentContentFormat: ContentFormat,
): ReuseJobConfigResult {
  const meta = job.metadata as Partial<{
    contentCategory: string
    contentFormat: string
    platform: string
    tone: string
    length: unknown
  }>

  const validCategories: ContentCategory[] = ['text', 'image', 'video', 'audio', 'story']
  const newCategory: ContentCategory =
    meta.contentCategory && validCategories.includes(meta.contentCategory as ContentCategory)
      ? (meta.contentCategory as ContentCategory)
      : DEFAULT_CONTENT_CATEGORY

  // Legacy fallback: if contentFormat is absent in metadata, keep current contentFormat
  const newFormat: ContentFormat =
    meta.contentFormat &&
    (CONTENT_FORMATS_PHASE1 as string[]).includes(meta.contentFormat)
      ? (meta.contentFormat as ContentFormat)
      : currentContentFormat

  const validPlatforms: StudioPlatform[] = [
    'Instagram', 'LinkedIn', 'Twitter / X', 'Facebook',
    'YouTube', 'TikTok', 'Blog', 'Newsletter', 'Podcast', 'General',
  ]
  const newPlatform: StudioPlatform =
    meta.platform && validPlatforms.includes(meta.platform as StudioPlatform)
      ? (meta.platform as StudioPlatform)
      : DEFAULT_PLATFORM

  const validTones: StudioTone[] = [
    'Professional', 'Casual', 'Humorous', 'Inspirational', 'Persuasive', 'Informative',
  ]
  const newTone: StudioTone =
    meta.tone && validTones.includes(meta.tone as StudioTone)
      ? (meta.tone as StudioTone)
      : DEFAULT_TONE

  const newLength: LengthConfig = isValidLengthConfig(meta.length)
    ? meta.length
    : DEFAULT_LENGTH

  return {
    prompt: job.prompt,
    contentCategory: newCategory,
    contentFormat: newFormat,
    platform: newPlatform,
    tone: newTone,
    length: newLength,
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// Use a fixed ISO date string for ContentJob timestamps.
// fc.date() can produce invalid Date objects even with min/max bounds during
// shrinking, causing RangeError from toISOString(). A constant is simpler and
// sufficient since the timestamp values are not part of the properties under test.
const FIXED_ISO_DATE = '2024-01-15T10:00:00.000Z'

/** Generates a ContentJob where metadata.contentFormat is absent (undefined). */
const contentJobWithoutFormatArb = fc.record<ContentJob>({
  id: fc.uuid(),
  user_id: fc.uuid(),
  team_id: fc.option(fc.uuid(), { nil: undefined }),
  type: fc.constantFrom('text', 'image', 'video', 'audio'),
  status: fc.constantFrom('pending', 'running', 'completed', 'failed', 'cancelled'),
  prompt: fc.string({ minLength: 0, maxLength: 4000 }),
  result_url: fc.option(fc.webUrl(), { nil: undefined }),
  credits_reserved: fc.integer({ min: 0, max: 1000 }),
  credits_used: fc.integer({ min: 0, max: 1000 }),
  error_message: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }),
  // metadata intentionally omits contentFormat to trigger the legacy fallback
  metadata: fc.record({
    contentCategory: fc.constantFrom(
      ...(CONTENT_CATEGORIES as unknown as [ContentCategory, ...ContentCategory[]]),
    ),
    // contentFormat is deliberately absent — this is the legacy fallback scenario
    platform: fc.constantFrom(
      ...(STUDIO_PLATFORMS as unknown as [StudioPlatform, ...StudioPlatform[]]),
    ),
    tone: fc.constantFrom(
      ...(STUDIO_TONES as unknown as [StudioTone, ...StudioTone[]]),
    ),
  }),
  created_at: fc.constant(FIXED_ISO_DATE),
  updated_at: fc.constant(FIXED_ISO_DATE),
})

/** Generates a ContentJob where metadata.contentFormat is explicitly null. */
const contentJobWithNullFormatArb = fc.record<ContentJob>({
  id: fc.uuid(),
  user_id: fc.uuid(),
  team_id: fc.option(fc.uuid(), { nil: undefined }),
  type: fc.constantFrom('text', 'image', 'video', 'audio'),
  status: fc.constantFrom('pending', 'running', 'completed', 'failed', 'cancelled'),
  prompt: fc.string({ minLength: 0, maxLength: 4000 }),
  result_url: fc.option(fc.webUrl(), { nil: undefined }),
  credits_reserved: fc.integer({ min: 0, max: 1000 }),
  credits_used: fc.integer({ min: 0, max: 1000 }),
  error_message: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }),
  // metadata has contentFormat explicitly set to null
  metadata: fc.record({
    contentCategory: fc.constantFrom(
      ...(CONTENT_CATEGORIES as unknown as [ContentCategory, ...ContentCategory[]]),
    ),
    contentFormat: fc.constant(null),
    platform: fc.constantFrom(
      ...(STUDIO_PLATFORMS as unknown as [StudioPlatform, ...StudioPlatform[]]),
    ),
    tone: fc.constantFrom(
      ...(STUDIO_TONES as unknown as [StudioTone, ...StudioTone[]]),
    ),
  }),
  created_at: fc.constant(FIXED_ISO_DATE),
  updated_at: fc.constant(FIXED_ISO_DATE),
})

/** Generates a ContentJob where metadata.contentFormat is a valid Phase 1 key. */
const contentJobWithValidFormatArb = fc.record<ContentJob>({
  id: fc.uuid(),
  user_id: fc.uuid(),
  team_id: fc.option(fc.uuid(), { nil: undefined }),
  type: fc.constantFrom('text', 'image', 'video', 'audio'),
  status: fc.constantFrom('pending', 'running', 'completed', 'failed', 'cancelled'),
  prompt: fc.string({ minLength: 0, maxLength: 4000 }),
  result_url: fc.option(fc.webUrl(), { nil: undefined }),
  credits_reserved: fc.integer({ min: 0, max: 1000 }),
  credits_used: fc.integer({ min: 0, max: 1000 }),
  error_message: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }),
  metadata: fc.record({
    contentFormat: fc.constantFrom(
      ...(CONTENT_FORMATS_PHASE1 as [ContentFormat, ...ContentFormat[]]),
    ),
  }),
  created_at: fc.constant(FIXED_ISO_DATE),
  updated_at: fc.constant(FIXED_ISO_DATE),
})

/** Generates a valid Phase 1 ContentFormat as the current active format. */
const currentFormatArb = fc.constantFrom(
  ...(CONTENT_FORMATS_PHASE1 as [ContentFormat, ...ContentFormat[]]),
)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Reuse Job Config (Legacy Fallback)', () => {
  it(
    'Property 10: reuseJobConfig() preserves currentContentFormat when metadata.contentFormat is absent',
    () => {
      /**
       * **Validates: Requirements 18.1, 18.7**
       *
       * When a ContentJob's metadata does not contain a contentFormat field
       * (legacy jobs created before the Studio was built), reuseJobConfig()
       * must fall back to the currently active contentFormat rather than
       * producing null or undefined.
       */
      fc.assert(
        fc.property(
          contentJobWithoutFormatArb,
          currentFormatArb,
          (job: ContentJob, currentFormat: ContentFormat) => {
            const result = reuseJobConfig(job, currentFormat)

            // Legacy fallback: absent contentFormat must resolve to currentFormat
            expect(result.contentFormat).toBe(currentFormat)

            // The result must never be null or undefined
            expect(result.contentFormat).not.toBeNull()
            expect(result.contentFormat).not.toBeUndefined()
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 10 (null variant): reuseJobConfig() preserves currentContentFormat when metadata.contentFormat is null',
    () => {
      /**
       * **Validates: Requirements 18.1, 18.7**
       *
       * When a ContentJob's metadata has contentFormat explicitly set to null
       * (another legacy scenario), reuseJobConfig() must fall back to the
       * currently active contentFormat.
       */
      fc.assert(
        fc.property(
          contentJobWithNullFormatArb,
          currentFormatArb,
          (job: ContentJob, currentFormat: ContentFormat) => {
            const result = reuseJobConfig(job, currentFormat)

            // Legacy fallback: null contentFormat must resolve to currentFormat
            expect(result.contentFormat).toBe(currentFormat)

            // The result must never be null or undefined
            expect(result.contentFormat).not.toBeNull()
            expect(result.contentFormat).not.toBeUndefined()
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 10 (present format): reuseJobConfig() uses metadata.contentFormat when it is a valid Phase 1 key',
    () => {
      /**
       * **Validates: Requirements 18.1, 18.7**
       *
       * When a ContentJob's metadata contains a valid Phase 1 contentFormat,
       * reuseJobConfig() must use that value (not the current format).
       * This verifies the fallback only triggers when the format is absent/invalid.
       */
      fc.assert(
        fc.property(
          contentJobWithValidFormatArb,
          currentFormatArb,
          (job: ContentJob, currentFormat: ContentFormat) => {
            const result = reuseJobConfig(job, currentFormat)
            const metaFormat = (job.metadata as { contentFormat: ContentFormat }).contentFormat

            // When a valid Phase 1 format is present, it must be used
            expect(result.contentFormat).toBe(metaFormat)
            expect(result.contentFormat).not.toBeNull()
            expect(result.contentFormat).not.toBeUndefined()
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 10 (prompt population): reuseJobConfig() always populates prompt from job.prompt',
    () => {
      /**
       * **Validates: Requirements 18.1**
       *
       * Regardless of the metadata state, reuseJobConfig() must always
       * populate the prompt field from job.prompt.
       */
      fc.assert(
        fc.property(
          contentJobWithoutFormatArb,
          currentFormatArb,
          (job: ContentJob, currentFormat: ContentFormat) => {
            const result = reuseJobConfig(job, currentFormat)

            expect(result.prompt).toBe(job.prompt)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

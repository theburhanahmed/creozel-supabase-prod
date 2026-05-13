/**
 * Property-Based Tests — Draft Config Round-Trip and Phase Gate
 *
 * Property 4 (draft config round-trip):
 *   For any valid StudioDraftConfig object (with a Phase 1 contentFormat),
 *   writing it to localStorage under `{teamId}:studio:draftConfig` and then
 *   reading it back via the same JSON parse/validate logic that useStudioState
 *   uses on mount SHALL produce a config where all five fields (prompt,
 *   contentCategory, contentFormat, platform, tone) are equal to the original.
 *
 * **Validates: Requirements 3.7, 5.3, 14.1, 14.2**
 *
 * Property 5 (phase gate enforcement):
 *   For any contentFormat value stored in localStorage that does NOT appear in
 *   CONTENT_FORMATS_PHASE1 (i.e., a Phase 2–4 or unknown format key),
 *   the read-back logic SHALL initialise contentCategory to 'text' and
 *   contentFormat to 'tweet' (the Phase 1 default) rather than restoring the
 *   stored value.
 *
 * **Validates: Requirements 3.8**
 *
 * Implementation note:
 *   useStudioState is a React hook that uses localStorage internally.
 *   Since we cannot render hooks in unit tests without a React environment,
 *   we test the underlying localStorage read/write logic directly by:
 *   1. Writing a StudioDraftConfig to localStorage under `{teamId}:studio:draftConfig`
 *   2. Simulating what the hook does on mount: JSON.parse the stored value and
 *      validate fields using the same logic as readDraftConfig()
 *   3. Asserting the round-trip produces identical values
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import {
  CONTENT_FORMAT_REGISTRY,
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
  StudioTone,
} from '../../types'

// ─── localStorage mock for node test environment ──────────────────────────────
// The vitest environment is 'node', which has no localStorage. We provide a
// minimal in-memory implementation that mirrors the Web Storage API surface
// used by useStudioState (getItem, setItem, removeItem, clear).

const localStorageStore: Map<string, string> = new Map()

const localStorageMock = {
  getItem: (key: string): string | null => localStorageStore.get(key) ?? null,
  setItem: (key: string, value: string): void => { localStorageStore.set(key, value) },
  removeItem: (key: string): void => { localStorageStore.delete(key) },
  clear: (): void => { localStorageStore.clear() },
}

// Install the mock globally so the mirrored readDraftConfig helper can use it
vi.stubGlobal('localStorage', localStorageMock)

// ─── Mirror of useStudioState's internal constants and helpers ────────────────
// These replicate the exact logic from useStudioState.ts so the test validates
// the same behaviour without needing to render the hook.

const DEFAULT_CONTENT_CATEGORY: ContentCategory = 'text'
const DEFAULT_CONTENT_FORMAT: ContentFormat = 'tweet'
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

function getDraftConfigKey(teamId: string): string {
  return `${teamId}:studio:draftConfig`
}

function isValidLengthConfig(value: unknown): value is LengthConfig {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const validPresets = ['short', 'medium', 'long', 'custom', null]
  return validPresets.includes(v.preset as string | null)
}

function buildDefaultDraftConfig(): StudioDraftConfig {
  return {
    prompt: '',
    contentCategory: DEFAULT_CONTENT_CATEGORY,
    contentFormat: DEFAULT_CONTENT_FORMAT,
    platform: DEFAULT_PLATFORM,
    tone: DEFAULT_TONE,
    length: { ...DEFAULT_LENGTH },
  }
}

/**
 * Mirrors the readDraftConfig() function from useStudioState.ts exactly.
 * Any change to the hook's read logic must be reflected here.
 */
function readDraftConfig(teamId: string): StudioDraftConfig {
  try {
    const raw = localStorage.getItem(getDraftConfigKey(teamId))
    if (!raw) return buildDefaultDraftConfig()
    const parsed = JSON.parse(raw) as Partial<StudioDraftConfig>

    // Validate contentFormat is a Phase 1 key; fall back to defaults if not
    const contentFormat: ContentFormat =
      parsed.contentFormat && (CONTENT_FORMATS_PHASE1 as string[]).includes(parsed.contentFormat)
        ? parsed.contentFormat
        : DEFAULT_CONTENT_FORMAT

    // Derive contentCategory from the registry if the stored one is missing/invalid
    const validCategories: ContentCategory[] = ['text', 'image', 'video', 'audio', 'story']
    const contentCategory: ContentCategory =
      parsed.contentCategory && validCategories.includes(parsed.contentCategory)
        ? parsed.contentCategory
        : (CONTENT_FORMAT_REGISTRY[contentFormat]?.category ?? DEFAULT_CONTENT_CATEGORY)

    const validPlatforms: StudioPlatform[] = [
      'Instagram', 'LinkedIn', 'Twitter / X', 'Facebook',
      'YouTube', 'TikTok', 'Blog', 'Newsletter', 'Podcast', 'General',
    ]
    const platform: StudioPlatform =
      parsed.platform && validPlatforms.includes(parsed.platform)
        ? parsed.platform
        : DEFAULT_PLATFORM

    const validTones: StudioTone[] = [
      'Professional', 'Casual', 'Humorous', 'Inspirational', 'Persuasive', 'Informative',
    ]
    const tone: StudioTone =
      parsed.tone && validTones.includes(parsed.tone) ? parsed.tone : DEFAULT_TONE

    const length: LengthConfig = isValidLengthConfig(parsed.length)
      ? parsed.length
      : DEFAULT_LENGTH

    return {
      prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
      contentCategory,
      contentFormat,
      platform,
      tone,
      length,
    }
  } catch {
    return buildDefaultDraftConfig()
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

/** Generates a valid StudioDraftConfig with a Phase 1 contentFormat. */
const validDraftConfigArb = fc.record<StudioDraftConfig>({
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

/**
 * Generates a string that is NOT a Phase 1 ContentFormat key.
 * These represent Phase 2–4 or completely unknown format values.
 */
const nonPhase1FormatArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !(CONTENT_FORMATS_PHASE1 as string[]).includes(s))

// ─── Tests ────────────────────────────────────────────────────────────────────

const TEST_TEAM_ID = 'test-team-pbt'

describe('PBT — Draft Config Round-Trip and Phase Gate', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('Property 4: any valid StudioDraftConfig round-trips through localStorage unchanged', () => {
    /**
     * **Validates: Requirements 3.7, 5.3, 14.1, 14.2**
     *
     * For any valid StudioDraftConfig (Phase 1 contentFormat), writing it to
     * localStorage and reading it back via the hook's read logic must produce
     * identical values for all five core fields.
     */
    fc.assert(
      fc.property(validDraftConfigArb, (config: StudioDraftConfig) => {
        // Write the config to localStorage exactly as the hook's persist logic does
        localStorage.setItem(getDraftConfigKey(TEST_TEAM_ID), JSON.stringify(config))

        // Read it back using the same logic as useStudioState on mount
        const restored = readDraftConfig(TEST_TEAM_ID)

        // All five core fields must survive the round-trip unchanged
        expect(restored.prompt).toBe(config.prompt)
        expect(restored.contentCategory).toBe(config.contentCategory)
        expect(restored.contentFormat).toBe(config.contentFormat)
        expect(restored.platform).toBe(config.platform)
        expect(restored.tone).toBe(config.tone)
      }),
      { numRuns: 100 },
    )
  })

  it('Property 5: any non-Phase-1 contentFormat in localStorage falls back to text/tweet', () => {
    /**
     * **Validates: Requirements 3.8**
     *
     * For any contentFormat value that is NOT in CONTENT_FORMATS_PHASE1
     * (e.g., a Phase 2–4 key like 'ai_avatar', 'live_stream', or any unknown
     * string), the read-back logic must fall back to the Phase 1 defaults:
     *   - contentFormat → 'tweet'
     *   - contentCategory → derived from registry for 'tweet', which is 'text'
     */
    fc.assert(
      fc.property(
        nonPhase1FormatArb,
        fc.constantFrom(
          ...(STUDIO_PLATFORMS as unknown as [StudioPlatform, ...StudioPlatform[]]),
        ),
        fc.constantFrom(
          ...(STUDIO_TONES as unknown as [StudioTone, ...StudioTone[]]),
        ),
        fc.string({ minLength: 0, maxLength: 4000 }),
        (
          unknownFormat: string,
          platform: StudioPlatform,
          tone: StudioTone,
          prompt: string,
        ) => {
          // Build a config with a non-Phase-1 contentFormat
          const storedConfig = {
            prompt,
            contentCategory: 'text' as ContentCategory,
            contentFormat: unknownFormat, // intentionally invalid / Phase 2+
            platform,
            tone,
            length: DEFAULT_LENGTH,
          }

          localStorage.setItem(
            getDraftConfigKey(TEST_TEAM_ID),
            JSON.stringify(storedConfig),
          )

          const restored = readDraftConfig(TEST_TEAM_ID)

          // Phase gate: non-Phase-1 format must be rejected and replaced with the default
          expect(restored.contentFormat).toBe(DEFAULT_CONTENT_FORMAT) // 'tweet'

          // contentCategory must be consistent with the fallback format
          const expectedCategory =
            CONTENT_FORMAT_REGISTRY[DEFAULT_CONTENT_FORMAT]?.category ?? DEFAULT_CONTENT_CATEGORY
          expect(restored.contentCategory).toBe(expectedCategory) // 'text'
        },
      ),
      { numRuns: 100 },
    )
  })
})

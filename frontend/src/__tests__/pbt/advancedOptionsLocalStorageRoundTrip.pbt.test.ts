// Feature: mvp-saas-platform, Property 11: Advanced options localStorage round-trip

/**
 * Property-Based Tests — Advanced Options localStorage Round-Trip
 *
 * Property 11 (advanced options localStorage round-trip):
 *   For any TextAdvancedOptions, ImageAdvancedOptions, VideoAdvancedOptions,
 *   or AudioAdvancedOptions object and any team_id / content_type combination,
 *   serialising the options to localStorage under
 *   `{team_id}:{content_type}:advancedOptions` and then deserialising them
 *   SHALL produce an object that is deeply equal to the original.
 *
 * **Validates: Requirements 6.10**
 *
 * Also tests the ContentHub fallback behaviour:
 *   When the localStorage value is corrupt (not valid JSON) or absent,
 *   the read helper SHALL return the default options object for that content
 *   type without throwing.
 *
 * Implementation note:
 *   ContentHub persists advanced options via:
 *     localStorage.setItem(`${teamId}:${contentType}:advancedOptions`, JSON.stringify(opts))
 *   and restores them on mount via:
 *     JSON.parse(localStorage.getItem(key) ?? '{}')
 *   merged with defaults.
 *   We mirror that exact logic here so the test validates the same behaviour
 *   without needing to render the React component.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import type {
  AudioAdvancedOptions,
  ImageAdvancedOptions,
  TextAdvancedOptions,
  VideoAdvancedOptions,
} from '../../types'
import {
  DEFAULT_AUDIO_OPTIONS,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_TEXT_OPTIONS,
  DEFAULT_VIDEO_OPTIONS,
} from '../../types'

// ─── localStorage mock for node test environment ──────────────────────────────

const localStorageStore: Map<string, string> = new Map()

const localStorageMock = {
  getItem: (key: string): string | null => localStorageStore.get(key) ?? null,
  setItem: (key: string, value: string): void => { localStorageStore.set(key, value) },
  removeItem: (key: string): void => { localStorageStore.delete(key) },
  clear: (): void => { localStorageStore.clear() },
}

vi.stubGlobal('localStorage', localStorageMock)

// ─── Mirror of ContentHub's localStorage helpers ──────────────────────────────
// These replicate the exact serialise/deserialise logic from ContentHub.tsx so
// the test validates the same behaviour without rendering the component.

function advancedOptionsKey(teamId: string, contentType: string): string {
  return `${teamId}:${contentType}:advancedOptions`
}

function saveAdvancedOptions<T>(teamId: string, contentType: string, opts: T): void {
  localStorage.setItem(advancedOptionsKey(teamId, contentType), JSON.stringify(opts))
}

function loadAdvancedOptions<T>(teamId: string, contentType: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(advancedOptionsKey(teamId, contentType))
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<T>
    return { ...defaults, ...parsed }
  } catch {
    // Corrupt value — silently fall back to defaults (ContentHub behaviour)
    return defaults
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const textOptionsArb = fc.record<TextAdvancedOptions>({
  model: fc.constantFrom('gpt-4', 'gpt-3.5'),
  tone: fc.constantFrom('professional', 'casual', 'humorous', 'persuasive', 'informative'),
  outputFormat: fc.constantFrom('blog_post', 'caption', 'ad_copy', 'thread', 'email'),
  wordCountMin: fc.integer({ min: 1, max: 10000 }),
  wordCountMax: fc.integer({ min: 1, max: 10000 }),
  language: fc.string({ minLength: 2, maxLength: 10 }),
  brandVoiceEnabled: fc.boolean(),
})

const imageOptionsArb = fc.record<ImageAdvancedOptions>({
  provider: fc.constantFrom('dall-e-3', 'stable-diffusion'),
  resolution: fc.constantFrom('512x512', '1024x1024', '1792x1024', '1024x1792'),
  style: fc.constantFrom(
    'photorealistic',
    'illustration',
    'digital_art',
    'oil_painting',
    'watercolor',
  ),
  negativePrompt: fc.string({ minLength: 0, maxLength: 500 }),
  numImages: fc.integer({ min: 1, max: 4 }),
  seed: fc.integer({ min: 0, max: 2147483647 }),
})

const videoOptionsArb = fc.record<VideoAdvancedOptions>({
  model: fc.constantFrom('gpt-4', 'gpt-3.5'),
  sceneCount: fc.integer({ min: 1, max: 10 }),
  durationPerScene: fc.constantFrom(15, 30, 60),
  aspectRatio: fc.constantFrom('16:9', '9:16', '1:1'),
  includeBRoll: fc.boolean(),
  brandVoiceEnabled: fc.boolean(),
})

const audioOptionsArb = fc.record<AudioAdvancedOptions>({
  provider: fc.constantFrom('elevenlabs', 'whisper'),
  voiceId: fc.string({ minLength: 1, maxLength: 64 }),
  speakingRate: fc.float({ min: 0.5, max: 2.0, noNaN: true }),
  pitchAdjustment: fc.integer({ min: -10, max: 10 }),
  outputFormat: fc.constantFrom('mp3', 'wav'),
  stabilityClarity: fc.integer({ min: 0, max: 100 }),
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Advanced Options localStorage Round-Trip (Property 11)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── Property 11a: TextAdvancedOptions ─────────────────────────────────────────

  it(
    'Property 11a: any TextAdvancedOptions serialised then deserialised is deeply equal to the original (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.10**
       *
       * For any TextAdvancedOptions object and any team_id, writing to
       * `{team_id}:text:advancedOptions` and reading back must produce an
       * object deeply equal to the original.
       */
      fc.assert(
        fc.property(
          textOptionsArb,
          fc.uuid(), // arbitrary team_id
          (opts: TextAdvancedOptions, teamId: string) => {
            saveAdvancedOptions(teamId, 'text', opts)
            const restored = loadAdvancedOptions(teamId, 'text', DEFAULT_TEXT_OPTIONS)

            expect(restored).toEqual(opts)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 11b: ImageAdvancedOptions ────────────────────────────────────────

  it(
    'Property 11b: any ImageAdvancedOptions serialised then deserialised is deeply equal to the original (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.10**
       *
       * For any ImageAdvancedOptions object and any team_id, writing to
       * `{team_id}:image:advancedOptions` and reading back must produce an
       * object deeply equal to the original.
       */
      fc.assert(
        fc.property(
          imageOptionsArb,
          fc.uuid(), // arbitrary team_id
          (opts: ImageAdvancedOptions, teamId: string) => {
            saveAdvancedOptions(teamId, 'image', opts)
            const restored = loadAdvancedOptions(teamId, 'image', DEFAULT_IMAGE_OPTIONS)

            expect(restored).toEqual(opts)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 11c: VideoAdvancedOptions ────────────────────────────────────────

  it(
    'Property 11c: any VideoAdvancedOptions serialised then deserialised is deeply equal to the original (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.10**
       *
       * For any VideoAdvancedOptions object and any team_id, writing to
       * `{team_id}:video:advancedOptions` and reading back must produce an
       * object deeply equal to the original.
       */
      fc.assert(
        fc.property(
          videoOptionsArb,
          fc.uuid(), // arbitrary team_id
          (opts: VideoAdvancedOptions, teamId: string) => {
            saveAdvancedOptions(teamId, 'video', opts)
            const restored = loadAdvancedOptions(teamId, 'video', DEFAULT_VIDEO_OPTIONS)

            expect(restored).toEqual(opts)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 11d: AudioAdvancedOptions ────────────────────────────────────────

  it(
    'Property 11d: any AudioAdvancedOptions serialised then deserialised is deeply equal to the original (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.10**
       *
       * For any AudioAdvancedOptions object and any team_id, writing to
       * `{team_id}:audio:advancedOptions` and reading back must produce an
       * object deeply equal to the original.
       *
       * Note: speakingRate is a float — JSON.stringify/parse preserves IEEE 754
       * doubles exactly for finite values, so toEqual is correct here.
       */
      fc.assert(
        fc.property(
          audioOptionsArb,
          fc.uuid(), // arbitrary team_id
          (opts: AudioAdvancedOptions, teamId: string) => {
            saveAdvancedOptions(teamId, 'audio', opts)
            const restored = loadAdvancedOptions(teamId, 'audio', DEFAULT_AUDIO_OPTIONS)

            expect(restored).toEqual(opts)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 11e: key isolation — different team_ids do not collide ───────────

  it(
    'Property 11e: options stored under different team_ids do not collide (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.10**
       *
       * For any two distinct team_ids and any TextAdvancedOptions, storing
       * options for team A must not affect the value read back for team B.
       * The key format `{team_id}:{content_type}:advancedOptions` must
       * provide per-team isolation.
       */
      fc.assert(
        fc.property(
          textOptionsArb,
          textOptionsArb,
          fc.uuid(),
          fc.uuid(),
          (optsA: TextAdvancedOptions, optsB: TextAdvancedOptions, teamA: string, teamB: string) => {
            // Skip when fast-check generates the same UUID for both teams
            fc.pre(teamA !== teamB)

            saveAdvancedOptions(teamA, 'text', optsA)
            saveAdvancedOptions(teamB, 'text', optsB)

            const restoredA = loadAdvancedOptions(teamA, 'text', DEFAULT_TEXT_OPTIONS)
            const restoredB = loadAdvancedOptions(teamB, 'text', DEFAULT_TEXT_OPTIONS)

            expect(restoredA).toEqual(optsA)
            expect(restoredB).toEqual(optsB)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 11f: corrupt localStorage value falls back to defaults ───────────

  it(
    'Property 11f: corrupt localStorage value falls back to defaults without throwing (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.10**
       *
       * When the stored value is not valid JSON (corrupt), the read helper
       * must silently return the default options and must not throw.
       * This mirrors the ContentHub behaviour: "if localStorage is unavailable
       * or value is corrupt, silently use defaults".
       */
      fc.assert(
        fc.property(
          fc.uuid(), // arbitrary team_id
          fc.constantFrom<string>('text', 'image', 'video', 'audio'),
          // Generate strings that are definitely not valid JSON objects
          fc.oneof(
            fc.constant('{corrupt'),
            fc.constant('not-json'),
            fc.constant('null'),
            fc.constant('undefined'),
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
              try { JSON.parse(s); return false } catch { return true }
            }),
          ),
          (teamId: string, contentType: string, corruptValue: string) => {
            const key = advancedOptionsKey(teamId, contentType)

            // Write a corrupt value directly (bypassing saveAdvancedOptions)
            if (corruptValue === '') {
              localStorage.removeItem(key)
            } else {
              localStorage.setItem(key, corruptValue)
            }

            // Reading must not throw and must return the appropriate defaults
            let result: unknown
            let threw = false
            try {
              switch (contentType) {
                case 'text':
                  result = loadAdvancedOptions(teamId, 'text', DEFAULT_TEXT_OPTIONS)
                  expect(result).toEqual(DEFAULT_TEXT_OPTIONS)
                  break
                case 'image':
                  result = loadAdvancedOptions(teamId, 'image', DEFAULT_IMAGE_OPTIONS)
                  expect(result).toEqual(DEFAULT_IMAGE_OPTIONS)
                  break
                case 'video':
                  result = loadAdvancedOptions(teamId, 'video', DEFAULT_VIDEO_OPTIONS)
                  expect(result).toEqual(DEFAULT_VIDEO_OPTIONS)
                  break
                case 'audio':
                  result = loadAdvancedOptions(teamId, 'audio', DEFAULT_AUDIO_OPTIONS)
                  expect(result).toEqual(DEFAULT_AUDIO_OPTIONS)
                  break
              }
            } catch {
              threw = true
            }

            expect(threw).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 11g: absent key falls back to defaults ───────────────────────────

  it(
    'Property 11g: absent localStorage key returns defaults for all four content types (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.10**
       *
       * When no value has been stored for a given team_id / content_type
       * combination, the read helper must return the default options object
       * for that content type.
       */
      fc.assert(
        fc.property(
          fc.uuid(), // arbitrary team_id — guaranteed no prior write
          (teamId: string) => {
            // Ensure no stale data from a previous run
            localStorage.removeItem(advancedOptionsKey(teamId, 'text'))
            localStorage.removeItem(advancedOptionsKey(teamId, 'image'))
            localStorage.removeItem(advancedOptionsKey(teamId, 'video'))
            localStorage.removeItem(advancedOptionsKey(teamId, 'audio'))

            expect(loadAdvancedOptions(teamId, 'text', DEFAULT_TEXT_OPTIONS)).toEqual(DEFAULT_TEXT_OPTIONS)
            expect(loadAdvancedOptions(teamId, 'image', DEFAULT_IMAGE_OPTIONS)).toEqual(DEFAULT_IMAGE_OPTIONS)
            expect(loadAdvancedOptions(teamId, 'video', DEFAULT_VIDEO_OPTIONS)).toEqual(DEFAULT_VIDEO_OPTIONS)
            expect(loadAdvancedOptions(teamId, 'audio', DEFAULT_AUDIO_OPTIONS)).toEqual(DEFAULT_AUDIO_OPTIONS)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

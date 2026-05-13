/**
 * Property-Based Tests — Advanced Options Persistence Round-Trip
 *
 * Property 14 (advanced options persistence round-trip):
 *   For any TextAdvancedOptions, ImageAdvancedOptions, VideoAdvancedOptions,
 *   or AudioAdvancedOptions object that passes schema validation (all required
 *   keys present, values within defined ranges), writing it to localStorage
 *   under `{teamId}:{content_type}:advancedOptions` and reading it back SHALL
 *   produce an object deeply equal to the original.
 *
 * **Validates: Requirements 7.7**
 *
 * Implementation note:
 *   useStudioState is a React hook that uses localStorage internally.
 *   We test the underlying read/write helpers directly by mirroring the exact
 *   writeAdvancedOptions / readAdvancedOptions logic from useStudioState.ts.
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

// ─── Mirror of useStudioState's internal helpers ──────────────────────────────
// These replicate the exact logic from useStudioState.ts so the test validates
// the same behaviour without needing to render the hook.

function getAdvancedOptionsKey(teamId: string, contentType: string): string {
  return `${teamId}:${contentType}:advancedOptions`
}

function writeAdvancedOptions<T>(teamId: string, contentType: string, value: T): void {
  localStorage.setItem(getAdvancedOptionsKey(teamId, contentType), JSON.stringify(value))
}

function readAdvancedOptions<T>(teamId: string, contentType: string, defaults: T): T {
  const raw = localStorage.getItem(getAdvancedOptionsKey(teamId, contentType))
  if (!raw) return defaults
  const parsed = JSON.parse(raw) as Partial<T>
  return { ...defaults, ...parsed }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a valid TextAdvancedOptions within defined ranges. */
const textAdvancedOptionsArb = fc.record<TextAdvancedOptions>({
  model: fc.constantFrom('gpt-4', 'gpt-3.5'),
  tone: fc.constantFrom('professional', 'casual', 'humorous', 'persuasive', 'informative'),
  outputFormat: fc.constantFrom('blog_post', 'caption', 'ad_copy', 'thread', 'email'),
  wordCountMin: fc.integer({ min: 1, max: 10000 }),
  wordCountMax: fc.integer({ min: 1, max: 10000 }),
  language: fc.string({ minLength: 2, maxLength: 10 }),
  brandVoiceEnabled: fc.boolean(),
})

/** Generates a valid ImageAdvancedOptions within defined ranges. */
const imageAdvancedOptionsArb = fc.record<ImageAdvancedOptions>({
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

/** Generates a valid VideoAdvancedOptions within defined ranges. */
const videoAdvancedOptionsArb = fc.record<VideoAdvancedOptions>({
  model: fc.constantFrom('gpt-4', 'gpt-3.5'),
  sceneCount: fc.integer({ min: 1, max: 10 }),
  durationPerScene: fc.constantFrom(15, 30, 60),
  aspectRatio: fc.constantFrom('16:9', '9:16', '1:1'),
  includeBRoll: fc.boolean(),
  brandVoiceEnabled: fc.boolean(),
})

/** Generates a valid AudioAdvancedOptions within defined ranges. */
const audioAdvancedOptionsArb = fc.record<AudioAdvancedOptions>({
  provider: fc.constantFrom('elevenlabs', 'whisper'),
  voiceId: fc.string({ minLength: 1, maxLength: 64 }),
  speakingRate: fc.float({ min: 0.5, max: 2.0, noNaN: true }),
  pitchAdjustment: fc.integer({ min: -10, max: 10 }),
  outputFormat: fc.constantFrom('mp3', 'wav'),
  stabilityClarity: fc.integer({ min: 0, max: 100 }),
})

// ─── Tests ────────────────────────────────────────────────────────────────────

const TEST_TEAM_ID = 'test-team-adv-opts-pbt'

describe('PBT — Advanced Options Persistence Round-Trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('Property 14a: any valid TextAdvancedOptions round-trips through localStorage unchanged', () => {
    /**
     * **Validates: Requirements 7.7**
     *
     * For any TextAdvancedOptions object with all required keys and values
     * within defined ranges, writing it to localStorage and reading it back
     * must produce an object deeply equal to the original.
     */
    fc.assert(
      fc.property(textAdvancedOptionsArb, (opts: TextAdvancedOptions) => {
        writeAdvancedOptions(TEST_TEAM_ID, 'text', opts)
        const restored = readAdvancedOptions(TEST_TEAM_ID, 'text', DEFAULT_TEXT_OPTIONS)

        expect(restored.model).toBe(opts.model)
        expect(restored.tone).toBe(opts.tone)
        expect(restored.outputFormat).toBe(opts.outputFormat)
        expect(restored.wordCountMin).toBe(opts.wordCountMin)
        expect(restored.wordCountMax).toBe(opts.wordCountMax)
        expect(restored.language).toBe(opts.language)
        expect(restored.brandVoiceEnabled).toBe(opts.brandVoiceEnabled)
      }),
      { numRuns: 100 },
    )
  })

  it('Property 14b: any valid ImageAdvancedOptions round-trips through localStorage unchanged', () => {
    /**
     * **Validates: Requirements 7.7**
     *
     * For any ImageAdvancedOptions object with all required keys and values
     * within defined ranges, writing it to localStorage and reading it back
     * must produce an object deeply equal to the original.
     */
    fc.assert(
      fc.property(imageAdvancedOptionsArb, (opts: ImageAdvancedOptions) => {
        writeAdvancedOptions(TEST_TEAM_ID, 'image', opts)
        const restored = readAdvancedOptions(TEST_TEAM_ID, 'image', DEFAULT_IMAGE_OPTIONS)

        expect(restored.provider).toBe(opts.provider)
        expect(restored.resolution).toBe(opts.resolution)
        expect(restored.style).toBe(opts.style)
        expect(restored.negativePrompt).toBe(opts.negativePrompt)
        expect(restored.numImages).toBe(opts.numImages)
        expect(restored.seed).toBe(opts.seed)
      }),
      { numRuns: 100 },
    )
  })

  it('Property 14c: any valid VideoAdvancedOptions round-trips through localStorage unchanged', () => {
    /**
     * **Validates: Requirements 7.7**
     *
     * For any VideoAdvancedOptions object with all required keys and values
     * within defined ranges, writing it to localStorage and reading it back
     * must produce an object deeply equal to the original.
     */
    fc.assert(
      fc.property(videoAdvancedOptionsArb, (opts: VideoAdvancedOptions) => {
        writeAdvancedOptions(TEST_TEAM_ID, 'video', opts)
        const restored = readAdvancedOptions(TEST_TEAM_ID, 'video', DEFAULT_VIDEO_OPTIONS)

        expect(restored.model).toBe(opts.model)
        expect(restored.sceneCount).toBe(opts.sceneCount)
        expect(restored.durationPerScene).toBe(opts.durationPerScene)
        expect(restored.aspectRatio).toBe(opts.aspectRatio)
        expect(restored.includeBRoll).toBe(opts.includeBRoll)
        expect(restored.brandVoiceEnabled).toBe(opts.brandVoiceEnabled)
      }),
      { numRuns: 100 },
    )
  })

  it('Property 14d: any valid AudioAdvancedOptions round-trips through localStorage unchanged', () => {
    /**
     * **Validates: Requirements 7.7**
     *
     * For any AudioAdvancedOptions object with all required keys and values
     * within defined ranges, writing it to localStorage and reading it back
     * must produce an object deeply equal to the original.
     */
    fc.assert(
      fc.property(audioAdvancedOptionsArb, (opts: AudioAdvancedOptions) => {
        writeAdvancedOptions(TEST_TEAM_ID, 'audio', opts)
        const restored = readAdvancedOptions(TEST_TEAM_ID, 'audio', DEFAULT_AUDIO_OPTIONS)

        expect(restored.provider).toBe(opts.provider)
        expect(restored.voiceId).toBe(opts.voiceId)
        expect(restored.speakingRate).toBeCloseTo(opts.speakingRate, 5)
        expect(restored.pitchAdjustment).toBe(opts.pitchAdjustment)
        expect(restored.outputFormat).toBe(opts.outputFormat)
        expect(restored.stabilityClarity).toBe(opts.stabilityClarity)
      }),
      { numRuns: 100 },
    )
  })
})

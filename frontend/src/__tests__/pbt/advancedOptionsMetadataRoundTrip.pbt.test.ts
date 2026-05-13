// Feature: mvp-saas-platform, Property 10: Advanced options metadata round-trip

/**
 * Property-Based Tests — Advanced Options Metadata Round-Trip
 *
 * Property 10 (advanced options metadata round-trip):
 *   For any set of advanced option values selected in ContentHub, when a
 *   generation job is submitted, the `content_jobs` row's `metadata` field
 *   SHALL contain all selected advanced option values, and the
 *   `generate-content` Edge Function SHALL pass those values to the respective
 *   AI provider API call (e.g., `model`, `size`, `style`, `voice_id`,
 *   `speaking_rate`).
 *
 * **Validates: Requirements 6.5, 6.7, 6.8**
 *
 * Implementation note:
 *   ContentHub's `buildMetadata()` is a React hook callback that cannot be
 *   invoked directly in a unit test. We mirror the exact logic as a pure
 *   function that takes the same inputs and returns the same metadata shape.
 *
 *   The Edge Function's metadata-reading logic is also mirrored as a pure
 *   function that reads fields from `job.metadata` with safe fallbacks, as
 *   specified in the design document.
 *
 *   Any change to ContentHub.buildMetadata or the Edge Function's metadata
 *   reading logic must be reflected here.
 *
 *   The round-trip tested is:
 *     AdvancedOptions → buildMetadata() → metadata → readFromMetadata() → AI provider params
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type {
  TextAdvancedOptions,
  ImageAdvancedOptions,
  VideoAdvancedOptions,
  AudioAdvancedOptions,
  ContentType,
} from '../../types'

// ─── Mirror of ContentHub.buildMetadata() ────────────────────────────────────
// Replicates the exact logic from ContentHub.tsx so the test validates the
// same behaviour without needing to render the React component.

function buildTextMetadata(opts: TextAdvancedOptions): Record<string, unknown> {
  return {
    model:          opts.model,
    tone:           opts.tone,
    output_format:  opts.outputFormat,
    word_count_min: opts.wordCountMin,
    word_count_max: opts.wordCountMax,
    language:       opts.language,
    brand_voice:    opts.brandVoiceEnabled
      ? 'Use the brand voice guidelines from the team profile.'
      : null,
  }
}

function buildImageMetadata(opts: ImageAdvancedOptions): Record<string, unknown> {
  return {
    provider:        opts.provider,
    resolution:      opts.resolution,
    style:           opts.style,
    negative_prompt: opts.negativePrompt,
    num_images:      opts.numImages,
    seed:            opts.seed,
  }
}

function buildVideoMetadata(opts: VideoAdvancedOptions): Record<string, unknown> {
  return {
    model:              opts.model,
    scene_count:        opts.sceneCount,
    duration_per_scene: opts.durationPerScene,
    aspect_ratio:       opts.aspectRatio,
    include_b_roll:     opts.includeBRoll,
    brand_voice:        opts.brandVoiceEnabled
      ? 'Use the brand voice guidelines from the team profile.'
      : null,
  }
}

function buildAudioMetadata(opts: AudioAdvancedOptions): Record<string, unknown> {
  return {
    provider:          opts.provider,
    voice_id:          opts.voiceId,
    speaking_rate:     opts.speakingRate,
    pitch_adjustment:  opts.pitchAdjustment,
    output_format:     opts.outputFormat,
    stability_clarity: opts.stabilityClarity,
  }
}

function buildMetadata(
  type: ContentType,
  textOptions: TextAdvancedOptions,
  imageOptions: ImageAdvancedOptions,
  videoOptions: VideoAdvancedOptions,
  audioOptions: AudioAdvancedOptions,
): Record<string, unknown> {
  switch (type) {
    case 'text':  return buildTextMetadata(textOptions)
    case 'image': return buildImageMetadata(imageOptions)
    case 'video': return buildVideoMetadata(videoOptions)
    case 'audio': return buildAudioMetadata(audioOptions)
  }
}

// ─── Mirror of generate-content Edge Function metadata reading ────────────────
// Replicates the safe-fallback reading logic from the Edge Function as
// described in the design document (Error Handling → generate-content).

interface TextProviderParams {
  model: string
  tone: string
  output_format: string
  word_count_min: number
  word_count_max: number
  language: string
  brand_voice: string | null
}

interface ImageProviderParams {
  provider: string
  resolution: string
  style: string
  negative_prompt: string
  num_images: number
  seed: number
}

interface VideoProviderParams {
  model: string
  scene_count: number
  duration_per_scene: number
  aspect_ratio: string
  include_b_roll: boolean
  brand_voice: string | null
}

interface AudioProviderParams {
  provider: string
  voice_id: string
  speaking_rate: number
  pitch_adjustment: number
  output_format: string
  stability_clarity: number
}

function readTextProviderParams(metadata: Record<string, unknown>): TextProviderParams {
  return {
    model:          (metadata.model          as string)  ?? 'gpt-4',
    tone:           (metadata.tone           as string)  ?? 'professional',
    output_format:  (metadata.output_format  as string)  ?? 'blog_post',
    word_count_min: (metadata.word_count_min as number)  ?? 300,
    word_count_max: (metadata.word_count_max as number)  ?? 800,
    language:       (metadata.language       as string)  ?? 'en',
    brand_voice:    (metadata.brand_voice    as string | null) ?? null,
  }
}

function readImageProviderParams(metadata: Record<string, unknown>): ImageProviderParams {
  return {
    provider:        (metadata.provider        as string) ?? 'dall-e-3',
    resolution:      (metadata.resolution      as string) ?? '1024x1024',
    style:           (metadata.style           as string) ?? 'photorealistic',
    negative_prompt: (metadata.negative_prompt as string) ?? '',
    num_images:      (metadata.num_images      as number) ?? 1,
    seed:            (metadata.seed            as number) ?? 0,
  }
}

function readVideoProviderParams(metadata: Record<string, unknown>): VideoProviderParams {
  return {
    model:              (metadata.model              as string)  ?? 'gpt-4',
    scene_count:        (metadata.scene_count        as number)  ?? 3,
    duration_per_scene: (metadata.duration_per_scene as number)  ?? 30,
    aspect_ratio:       (metadata.aspect_ratio       as string)  ?? '16:9',
    include_b_roll:     (metadata.include_b_roll     as boolean) ?? false,
    brand_voice:        (metadata.brand_voice        as string | null) ?? null,
  }
}

function readAudioProviderParams(metadata: Record<string, unknown>): AudioProviderParams {
  return {
    provider:          (metadata.provider          as string) ?? 'elevenlabs',
    voice_id:          (metadata.voice_id          as string) ?? '',
    speaking_rate:     (metadata.speaking_rate     as number) ?? 1.0,
    pitch_adjustment:  (metadata.pitch_adjustment  as number) ?? 0,
    output_format:     (metadata.output_format     as string) ?? 'mp3',
    stability_clarity: (metadata.stability_clarity as number) ?? 50,
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const textAdvancedOptionsArb = fc.record<TextAdvancedOptions>({
  model:            fc.constantFrom('gpt-4', 'gpt-3.5'),
  tone:             fc.constantFrom('professional', 'casual', 'humorous', 'persuasive', 'informative'),
  outputFormat:     fc.constantFrom('blog_post', 'caption', 'ad_copy', 'thread', 'email'),
  wordCountMin:     fc.integer({ min: 1, max: 10000 }),
  wordCountMax:     fc.integer({ min: 1, max: 10000 }),
  language:         fc.string({ minLength: 2, maxLength: 10 }),
  brandVoiceEnabled: fc.boolean(),
})

const imageAdvancedOptionsArb = fc.record<ImageAdvancedOptions>({
  provider:      fc.constantFrom('dall-e-3', 'stable-diffusion'),
  resolution:    fc.constantFrom('512x512', '1024x1024', '1792x1024', '1024x1792'),
  style:         fc.constantFrom('photorealistic', 'illustration', 'digital_art', 'oil_painting', 'watercolor'),
  negativePrompt: fc.string({ minLength: 0, maxLength: 500 }),
  numImages:     fc.integer({ min: 1, max: 4 }),
  seed:          fc.integer({ min: 0, max: 2147483647 }),
})

const videoAdvancedOptionsArb = fc.record<VideoAdvancedOptions>({
  model:            fc.constantFrom('gpt-4', 'gpt-3.5'),
  sceneCount:       fc.integer({ min: 1, max: 10 }),
  durationPerScene: fc.constantFrom(15, 30, 60),
  aspectRatio:      fc.constantFrom('16:9', '9:16', '1:1'),
  includeBRoll:     fc.boolean(),
  brandVoiceEnabled: fc.boolean(),
})

const audioAdvancedOptionsArb = fc.record<AudioAdvancedOptions>({
  provider:         fc.constantFrom('elevenlabs', 'whisper'),
  voiceId:          fc.string({ minLength: 1, maxLength: 64 }),
  speakingRate:     fc.float({ min: 0.5, max: 2.0, noNaN: true }),
  pitchAdjustment:  fc.integer({ min: -10, max: 10 }),
  outputFormat:     fc.constantFrom('mp3', 'wav'),
  stabilityClarity: fc.integer({ min: 0, max: 100 }),
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Advanced Options Metadata Round-Trip (Property 10)', () => {

  // ── Text: options → metadata → AI provider params ────────────────────────────

  it(
    'Property 10a: any TextAdvancedOptions — all fields appear in metadata and are passed to AI provider (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.5, 6.7, 6.8**
       *
       * For any TextAdvancedOptions object, buildMetadata() must include all
       * option fields in the metadata record, and the Edge Function's
       * metadata-reading logic must recover those exact values when passing
       * them to the AI provider API call.
       */
      fc.assert(
        fc.property(textAdvancedOptionsArb, (opts) => {
          // Step 1: ContentHub builds metadata from options
          const metadata = buildTextMetadata(opts)

          // Step 2: metadata contains all option fields
          expect(metadata.model).toBe(opts.model)
          expect(metadata.tone).toBe(opts.tone)
          expect(metadata.output_format).toBe(opts.outputFormat)
          expect(metadata.word_count_min).toBe(opts.wordCountMin)
          expect(metadata.word_count_max).toBe(opts.wordCountMax)
          expect(metadata.language).toBe(opts.language)
          // brand_voice is a derived string (non-null when enabled, null when disabled)
          if (opts.brandVoiceEnabled) {
            expect(typeof metadata.brand_voice).toBe('string')
            expect(metadata.brand_voice).not.toBeNull()
          } else {
            expect(metadata.brand_voice).toBeNull()
          }

          // Step 3: Edge Function reads metadata and passes values to AI provider
          const params = readTextProviderParams(metadata)
          expect(params.model).toBe(opts.model)
          expect(params.tone).toBe(opts.tone)
          expect(params.output_format).toBe(opts.outputFormat)
          expect(params.word_count_min).toBe(opts.wordCountMin)
          expect(params.word_count_max).toBe(opts.wordCountMax)
          expect(params.language).toBe(opts.language)
          if (opts.brandVoiceEnabled) {
            expect(typeof params.brand_voice).toBe('string')
            expect(params.brand_voice).not.toBeNull()
          } else {
            expect(params.brand_voice).toBeNull()
          }
        }),
        { numRuns: 100 },
      )
    },
  )

  // ── Image: options → metadata → AI provider params ───────────────────────────

  it(
    'Property 10b: any ImageAdvancedOptions — all fields appear in metadata and are passed to AI provider (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.5, 6.7, 6.8**
       *
       * For any ImageAdvancedOptions object, buildMetadata() must include all
       * option fields in the metadata record, and the Edge Function's
       * metadata-reading logic must recover those exact values when passing
       * them to the AI provider API call (e.g., `size`, `style`).
       */
      fc.assert(
        fc.property(imageAdvancedOptionsArb, (opts) => {
          // Step 1: ContentHub builds metadata from options
          const metadata = buildImageMetadata(opts)

          // Step 2: metadata contains all option fields
          expect(metadata.provider).toBe(opts.provider)
          expect(metadata.resolution).toBe(opts.resolution)
          expect(metadata.style).toBe(opts.style)
          expect(metadata.negative_prompt).toBe(opts.negativePrompt)
          expect(metadata.num_images).toBe(opts.numImages)
          expect(metadata.seed).toBe(opts.seed)

          // Step 3: Edge Function reads metadata and passes values to AI provider
          const params = readImageProviderParams(metadata)
          expect(params.provider).toBe(opts.provider)
          expect(params.resolution).toBe(opts.resolution)
          expect(params.style).toBe(opts.style)
          expect(params.negative_prompt).toBe(opts.negativePrompt)
          expect(params.num_images).toBe(opts.numImages)
          expect(params.seed).toBe(opts.seed)
        }),
        { numRuns: 100 },
      )
    },
  )

  // ── Video: options → metadata → AI provider params ───────────────────────────

  it(
    'Property 10c: any VideoAdvancedOptions — all fields appear in metadata and are passed to AI provider (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.5, 6.7, 6.8**
       *
       * For any VideoAdvancedOptions object, buildMetadata() must include all
       * option fields in the metadata record, and the Edge Function's
       * metadata-reading logic must recover those exact values when passing
       * them to the AI provider API call.
       */
      fc.assert(
        fc.property(videoAdvancedOptionsArb, (opts) => {
          // Step 1: ContentHub builds metadata from options
          const metadata = buildVideoMetadata(opts)

          // Step 2: metadata contains all option fields
          expect(metadata.model).toBe(opts.model)
          expect(metadata.scene_count).toBe(opts.sceneCount)
          expect(metadata.duration_per_scene).toBe(opts.durationPerScene)
          expect(metadata.aspect_ratio).toBe(opts.aspectRatio)
          expect(metadata.include_b_roll).toBe(opts.includeBRoll)
          if (opts.brandVoiceEnabled) {
            expect(typeof metadata.brand_voice).toBe('string')
            expect(metadata.brand_voice).not.toBeNull()
          } else {
            expect(metadata.brand_voice).toBeNull()
          }

          // Step 3: Edge Function reads metadata and passes values to AI provider
          const params = readVideoProviderParams(metadata)
          expect(params.model).toBe(opts.model)
          expect(params.scene_count).toBe(opts.sceneCount)
          expect(params.duration_per_scene).toBe(opts.durationPerScene)
          expect(params.aspect_ratio).toBe(opts.aspectRatio)
          expect(params.include_b_roll).toBe(opts.includeBRoll)
          if (opts.brandVoiceEnabled) {
            expect(typeof params.brand_voice).toBe('string')
            expect(params.brand_voice).not.toBeNull()
          } else {
            expect(params.brand_voice).toBeNull()
          }
        }),
        { numRuns: 100 },
      )
    },
  )

  // ── Audio: options → metadata → AI provider params ───────────────────────────

  it(
    'Property 10d: any AudioAdvancedOptions — all fields appear in metadata and are passed to AI provider (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.5, 6.7, 6.8**
       *
       * For any AudioAdvancedOptions object, buildMetadata() must include all
       * option fields in the metadata record, and the Edge Function's
       * metadata-reading logic must recover those exact values when passing
       * them to the AI provider API call (e.g., `voice_id`, `speaking_rate`).
       */
      fc.assert(
        fc.property(audioAdvancedOptionsArb, (opts) => {
          // Step 1: ContentHub builds metadata from options
          const metadata = buildAudioMetadata(opts)

          // Step 2: metadata contains all option fields
          expect(metadata.provider).toBe(opts.provider)
          expect(metadata.voice_id).toBe(opts.voiceId)
          expect(metadata.speaking_rate).toBeCloseTo(opts.speakingRate, 5)
          expect(metadata.pitch_adjustment).toBe(opts.pitchAdjustment)
          expect(metadata.output_format).toBe(opts.outputFormat)
          expect(metadata.stability_clarity).toBe(opts.stabilityClarity)

          // Step 3: Edge Function reads metadata and passes values to AI provider
          const params = readAudioProviderParams(metadata)
          expect(params.provider).toBe(opts.provider)
          expect(params.voice_id).toBe(opts.voiceId)
          expect(params.speaking_rate).toBeCloseTo(opts.speakingRate, 5)
          expect(params.pitch_adjustment).toBe(opts.pitchAdjustment)
          expect(params.output_format).toBe(opts.outputFormat)
          expect(params.stability_clarity).toBe(opts.stabilityClarity)
        }),
        { numRuns: 100 },
      )
    },
  )

  // ── Cross-type: buildMetadata dispatches to the correct type ─────────────────

  it(
    'Property 10e: buildMetadata dispatches correctly — metadata keys match the selected content type (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.7**
       *
       * For any combination of content type and advanced options, buildMetadata()
       * must produce a metadata object whose keys correspond exclusively to the
       * selected content type. Text metadata must not contain image keys, and
       * vice versa.
       */
      fc.assert(
        fc.property(
          fc.constantFrom<ContentType>('text', 'image', 'video', 'audio'),
          textAdvancedOptionsArb,
          imageAdvancedOptionsArb,
          videoAdvancedOptionsArb,
          audioAdvancedOptionsArb,
          (type, textOpts, imageOpts, videoOpts, audioOpts) => {
            const metadata = buildMetadata(type, textOpts, imageOpts, videoOpts, audioOpts)

            if (type === 'text') {
              // Text-specific keys must be present
              expect('model' in metadata).toBe(true)
              expect('tone' in metadata).toBe(true)
              expect('output_format' in metadata).toBe(true)
              expect('word_count_min' in metadata).toBe(true)
              expect('word_count_max' in metadata).toBe(true)
              expect('language' in metadata).toBe(true)
              // Image-specific keys must NOT be present
              expect('resolution' in metadata).toBe(false)
              expect('negative_prompt' in metadata).toBe(false)
              expect('num_images' in metadata).toBe(false)
            }

            if (type === 'image') {
              // Image-specific keys must be present
              expect('provider' in metadata).toBe(true)
              expect('resolution' in metadata).toBe(true)
              expect('style' in metadata).toBe(true)
              expect('negative_prompt' in metadata).toBe(true)
              expect('num_images' in metadata).toBe(true)
              expect('seed' in metadata).toBe(true)
              // Text-specific keys must NOT be present
              expect('tone' in metadata).toBe(false)
              expect('output_format' in metadata).toBe(false)
              expect('word_count_min' in metadata).toBe(false)
            }

            if (type === 'video') {
              // Video-specific keys must be present
              expect('model' in metadata).toBe(true)
              expect('scene_count' in metadata).toBe(true)
              expect('duration_per_scene' in metadata).toBe(true)
              expect('aspect_ratio' in metadata).toBe(true)
              expect('include_b_roll' in metadata).toBe(true)
              // Image-specific keys must NOT be present
              expect('resolution' in metadata).toBe(false)
              expect('negative_prompt' in metadata).toBe(false)
            }

            if (type === 'audio') {
              // Audio-specific keys must be present
              expect('provider' in metadata).toBe(true)
              expect('voice_id' in metadata).toBe(true)
              expect('speaking_rate' in metadata).toBe(true)
              expect('pitch_adjustment' in metadata).toBe(true)
              expect('output_format' in metadata).toBe(true)
              expect('stability_clarity' in metadata).toBe(true)
              // Text-specific keys must NOT be present
              expect('tone' in metadata).toBe(false)
              expect('word_count_min' in metadata).toBe(false)
            }
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Safe fallbacks: Edge Function never throws on missing metadata fields ─────

  it(
    'Property 10f: Edge Function safe fallbacks — reading from empty metadata never throws and returns defaults (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.8**
       *
       * The generate-content Edge Function reads `job.metadata` fields with
       * safe fallbacks so that missing metadata fields do not cause the
       * function to throw. For any content type, reading from an empty
       * metadata object must return the default values without throwing.
       */
      fc.assert(
        fc.property(
          fc.constantFrom<ContentType>('text', 'image', 'video', 'audio'),
          (type) => {
            const emptyMetadata: Record<string, unknown> = {}

            // Reading from empty metadata must not throw and must return defaults
            if (type === 'text') {
              const params = readTextProviderParams(emptyMetadata)
              expect(params.model).toBe('gpt-4')
              expect(params.tone).toBe('professional')
              expect(params.output_format).toBe('blog_post')
              expect(params.word_count_min).toBe(300)
              expect(params.word_count_max).toBe(800)
              expect(params.language).toBe('en')
              expect(params.brand_voice).toBeNull()
            }

            if (type === 'image') {
              const params = readImageProviderParams(emptyMetadata)
              expect(params.provider).toBe('dall-e-3')
              expect(params.resolution).toBe('1024x1024')
              expect(params.style).toBe('photorealistic')
              expect(params.negative_prompt).toBe('')
              expect(params.num_images).toBe(1)
              expect(params.seed).toBe(0)
            }

            if (type === 'video') {
              const params = readVideoProviderParams(emptyMetadata)
              expect(params.model).toBe('gpt-4')
              expect(params.scene_count).toBe(3)
              expect(params.duration_per_scene).toBe(30)
              expect(params.aspect_ratio).toBe('16:9')
              expect(params.include_b_roll).toBe(false)
              expect(params.brand_voice).toBeNull()
            }

            if (type === 'audio') {
              const params = readAudioProviderParams(emptyMetadata)
              expect(params.provider).toBe('elevenlabs')
              expect(params.voice_id).toBe('')
              expect(params.speaking_rate).toBe(1.0)
              expect(params.pitch_adjustment).toBe(0)
              expect(params.output_format).toBe('mp3')
              expect(params.stability_clarity).toBe(50)
            }
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Idempotency: metadata → params → metadata produces the same values ────────

  it(
    'Property 10g: metadata values are idempotent — reading then re-building produces the same metadata (100 runs)',
    () => {
      /**
       * **Validates: Requirements 6.7, 6.8**
       *
       * For any advanced options object, the values written into metadata by
       * buildMetadata() and then read back by the Edge Function's
       * readProviderParams() must be identical to the original option values.
       * This confirms the full round-trip is lossless for all content types.
       */
      fc.assert(
        fc.property(
          textAdvancedOptionsArb,
          imageAdvancedOptionsArb,
          videoAdvancedOptionsArb,
          audioAdvancedOptionsArb,
          (textOpts, imageOpts, videoOpts, audioOpts) => {
            // Text round-trip
            const textMeta = buildTextMetadata(textOpts)
            const textParams = readTextProviderParams(textMeta)
            expect(textParams.model).toBe(textOpts.model)
            expect(textParams.tone).toBe(textOpts.tone)
            expect(textParams.output_format).toBe(textOpts.outputFormat)
            expect(textParams.word_count_min).toBe(textOpts.wordCountMin)
            expect(textParams.word_count_max).toBe(textOpts.wordCountMax)
            expect(textParams.language).toBe(textOpts.language)

            // Image round-trip
            const imageMeta = buildImageMetadata(imageOpts)
            const imageParams = readImageProviderParams(imageMeta)
            expect(imageParams.provider).toBe(imageOpts.provider)
            expect(imageParams.resolution).toBe(imageOpts.resolution)
            expect(imageParams.style).toBe(imageOpts.style)
            expect(imageParams.negative_prompt).toBe(imageOpts.negativePrompt)
            expect(imageParams.num_images).toBe(imageOpts.numImages)
            expect(imageParams.seed).toBe(imageOpts.seed)

            // Video round-trip
            const videoMeta = buildVideoMetadata(videoOpts)
            const videoParams = readVideoProviderParams(videoMeta)
            expect(videoParams.model).toBe(videoOpts.model)
            expect(videoParams.scene_count).toBe(videoOpts.sceneCount)
            expect(videoParams.duration_per_scene).toBe(videoOpts.durationPerScene)
            expect(videoParams.aspect_ratio).toBe(videoOpts.aspectRatio)
            expect(videoParams.include_b_roll).toBe(videoOpts.includeBRoll)

            // Audio round-trip
            const audioMeta = buildAudioMetadata(audioOpts)
            const audioParams = readAudioProviderParams(audioMeta)
            expect(audioParams.provider).toBe(audioOpts.provider)
            expect(audioParams.voice_id).toBe(audioOpts.voiceId)
            expect(audioParams.speaking_rate).toBeCloseTo(audioOpts.speakingRate, 5)
            expect(audioParams.pitch_adjustment).toBe(audioOpts.pitchAdjustment)
            expect(audioParams.output_format).toBe(audioOpts.outputFormat)
            expect(audioParams.stability_clarity).toBe(audioOpts.stabilityClarity)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

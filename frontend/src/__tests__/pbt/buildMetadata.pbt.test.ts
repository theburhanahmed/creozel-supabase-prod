/**
 * Property-Based Tests — Metadata Completeness
 *
 * Property 6 (metadata completeness):
 *   For any valid combination of Studio state inputs, buildMetadata() SHALL
 *   return a ContentFormatMetadataSchema where all required fields are non-null
 *   and schemaVersion === '1'.
 *
 *   Specifically:
 *   - result.contentCategory is non-null
 *   - result.contentFormat is non-null
 *   - result.platform is non-null
 *   - result.tone is non-null
 *   - result.length is non-null (object)
 *   - result.schemaVersion === '1'
 *   - result.advancedOptions is non-null (object)
 *   - result.platformConstraints is non-null (object)
 *
 * **Validates: Requirements 3.7, 10.3**
 *
 * Implementation note:
 *   buildMetadata() is an internal method of the useStudioState hook.
 *   Since we cannot render hooks in unit tests without a React environment,
 *   we mirror the exact logic from useStudioState.ts as a standalone function
 *   that takes the same inputs and returns a ContentFormatMetadataSchema.
 *   Any change to the hook's buildMetadata logic must be reflected here.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  CONTENT_FORMAT_REGISTRY,
  CONTENT_FORMATS_PHASE1,
  CONTENT_CATEGORIES,
  STUDIO_PLATFORMS,
  STUDIO_TONES,
} from '../../constants/contentFormatRegistry'
import type {
  AudioAdvancedOptions,
  ContentCategory,
  ContentFormat,
  ContentFormatMetadataSchema,
  ImageAdvancedOptions,
  LengthConfig,
  RepurposingSource,
  StudioPlatform,
  StudioTone,
  TextAdvancedOptions,
  VideoAdvancedOptions,
} from '../../types'
import {
  DEFAULT_AUDIO_OPTIONS,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_TEXT_OPTIONS,
  DEFAULT_VIDEO_OPTIONS,
} from '../../types'

// ─── Mirror of useStudioState's buildMetadata logic ───────────────────────────
// This replicates the exact logic from useStudioState.ts so the test validates
// the same behaviour without needing to render the hook.

interface BuildMetadataInputs {
  contentCategory: ContentCategory
  contentFormat: ContentFormat
  platform: StudioPlatform
  tone: StudioTone
  length: LengthConfig
  textOptions: TextAdvancedOptions
  imageOptions: ImageAdvancedOptions
  videoOptions: VideoAdvancedOptions
  audioOptions: AudioAdvancedOptions
  repurposingSource: RepurposingSource | null
  repurposingInstructions: string
}

function buildMetadata(inputs: BuildMetadataInputs): ContentFormatMetadataSchema {
  const {
    contentCategory,
    contentFormat,
    platform,
    tone,
    length,
    textOptions,
    imageOptions,
    videoOptions,
    audioOptions,
    repurposingSource,
    repurposingInstructions,
  } = inputs

  // Derive platform constraints from the registry
  const registryEntry = CONTENT_FORMAT_REGISTRY[contentFormat]
  const platformConstraints = registryEntry?.constraints[platform] ?? {
    characterLimit: null,
    aspectRatio: null,
    durationLimitSeconds: null,
    fileSizeLimitMb: null,
    acceptedFileFormats: [],
  }

  // Flatten advanced options into the unified schema shape
  const advancedOptions: ContentFormatMetadataSchema['advancedOptions'] = {
    model:
      contentCategory === 'text'
        ? textOptions.model
        : contentCategory === 'video'
          ? videoOptions.model
          : null,
    resolution: contentCategory === 'image' ? imageOptions.resolution : null,
    style: contentCategory === 'image' ? imageOptions.style : null,
    negativePrompt: contentCategory === 'image' ? imageOptions.negativePrompt : null,
    seed: contentCategory === 'image' ? imageOptions.seed : null,
    voice: contentCategory === 'audio' ? audioOptions.voiceId : null,
    pitch: contentCategory === 'audio' ? audioOptions.pitchAdjustment : null,
    stability: contentCategory === 'audio' ? audioOptions.stabilityClarity : null,
    outputFormat:
      contentCategory === 'audio'
        ? audioOptions.outputFormat
        : null,
    aspectRatio: contentCategory === 'video' ? videoOptions.aspectRatio : null,
    includeBRoll: null,
    brandVoice:
      contentCategory === 'text' ? textOptions.brandVoiceEnabled : null,
    language: contentCategory === 'text' ? textOptions.language : null,
  }

  return {
    contentCategory,
    contentFormat,
    platform,
    tone,
    length,
    advancedOptions,
    platformConstraints,
    sourceJobId: repurposingSource?.type === 'job' ? repurposingSource.id : null,
    sourceMediaId: repurposingSource?.type === 'media' ? repurposingSource.id : null,
    repurposingInstructions: repurposingInstructions || null,
    schemaVersion: '1',
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

const buildMetadataInputsArb = fc.record<BuildMetadataInputs>({
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
  textOptions: fc.constant(DEFAULT_TEXT_OPTIONS),
  imageOptions: fc.constant(DEFAULT_IMAGE_OPTIONS),
  videoOptions: fc.constant(DEFAULT_VIDEO_OPTIONS),
  audioOptions: fc.constant(DEFAULT_AUDIO_OPTIONS),
  repurposingSource: fc.constant(null),
  repurposingInstructions: fc.string({ minLength: 0, maxLength: 200 }),
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Metadata Completeness', () => {
  it(
    'Property 6: buildMetadata() always returns a ContentFormatMetadataSchema with all required fields non-null and schemaVersion === "1"',
    () => {
      /**
       * **Validates: Requirements 3.7, 10.3**
       *
       * For any valid combination of Studio state inputs, buildMetadata() must
       * return a fully populated ContentFormatMetadataSchema. No required field
       * may be null or undefined, and schemaVersion must always be '1'.
       */
      fc.assert(
        fc.property(buildMetadataInputsArb, (inputs: BuildMetadataInputs) => {
          const result = buildMetadata(inputs)

          // Core taxonomy fields must be non-null
          expect(result.contentCategory).not.toBeNull()
          expect(result.contentCategory).not.toBeUndefined()

          expect(result.contentFormat).not.toBeNull()
          expect(result.contentFormat).not.toBeUndefined()

          expect(result.platform).not.toBeNull()
          expect(result.platform).not.toBeUndefined()

          expect(result.tone).not.toBeNull()
          expect(result.tone).not.toBeUndefined()

          // Length must be a non-null object
          expect(result.length).not.toBeNull()
          expect(result.length).not.toBeUndefined()
          expect(typeof result.length).toBe('object')

          // schemaVersion must always be '1'
          expect(result.schemaVersion).toBe('1')

          // advancedOptions must be a non-null object
          expect(result.advancedOptions).not.toBeNull()
          expect(result.advancedOptions).not.toBeUndefined()
          expect(typeof result.advancedOptions).toBe('object')

          // platformConstraints must be a non-null object
          expect(result.platformConstraints).not.toBeNull()
          expect(result.platformConstraints).not.toBeUndefined()
          expect(typeof result.platformConstraints).toBe('object')
        }),
        { numRuns: 100 },
      )
    },
  )
})

/**
 * Property-Based Tests — Constraint Hint Accuracy
 *
 * Property 13 (constraint hint accuracy):
 *   For every format+platform combination listed in Requirement 16.3,
 *   assert that CONTENT_FORMAT_REGISTRY[format].constraints[platform]
 *   returns a PlatformConstraints object whose fields exactly match the
 *   specified values.
 *
 *   Note: usePlatformConstraints (task 6.3) is a pure memoised derivation
 *   of CONTENT_FORMAT_REGISTRY[format].constraints[platform]. Testing the
 *   underlying data directly is equivalent and avoids a React hook dependency
 *   before the hook is implemented.
 *
 * **Validates: Requirements 16.3**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { CONTENT_FORMAT_REGISTRY } from '../../constants/contentFormatRegistry'
import type { ContentFormat, StudioPlatform, PlatformConstraints } from '../../types'

// ─── Expected constraint values per Requirement 16.3 ─────────────────────────

interface ConstraintTestCase {
  format: ContentFormat
  platform: StudioPlatform
  expected: PlatformConstraints
}

const EXPECTED_CONSTRAINTS: ConstraintTestCase[] = [
  {
    format: 'tweet',
    platform: 'Twitter / X',
    expected: {
      characterLimit: 280,
      aspectRatio: null,
      durationLimitSeconds: null,
      fileSizeLimitMb: null,
      acceptedFileFormats: ['text'],
    },
  },
  {
    format: 'thread',
    platform: 'Twitter / X',
    expected: {
      characterLimit: 280,
      aspectRatio: null,
      durationLimitSeconds: null,
      fileSizeLimitMb: null,
      acceptedFileFormats: ['text'],
    },
  },
  {
    format: 'caption',
    platform: 'Instagram',
    expected: {
      characterLimit: 2200,
      aspectRatio: '1:1 or 4:5',
      durationLimitSeconds: null,
      fileSizeLimitMb: null,
      acceptedFileFormats: ['text'],
    },
  },
  {
    format: 'caption',
    platform: 'LinkedIn',
    expected: {
      characterLimit: 3000,
      aspectRatio: null,
      durationLimitSeconds: null,
      fileSizeLimitMb: null,
      acceptedFileFormats: ['text'],
    },
  },
  {
    format: 'reel',
    platform: 'Instagram',
    expected: {
      characterLimit: null,
      aspectRatio: '9:16',
      durationLimitSeconds: 90,
      fileSizeLimitMb: null,
      acceptedFileFormats: ['MP4'],
    },
  },
  {
    format: 'short',
    platform: 'YouTube',
    expected: {
      characterLimit: null,
      aspectRatio: '9:16',
      durationLimitSeconds: 60,
      fileSizeLimitMb: null,
      acceptedFileFormats: ['MP4'],
    },
  },
  {
    format: 'tiktok_video',
    platform: 'TikTok',
    expected: {
      characterLimit: null,
      aspectRatio: '9:16',
      durationLimitSeconds: 600,
      fileSizeLimitMb: null,
      acceptedFileFormats: ['MP4'],
    },
  },
  {
    format: 'carousel',
    platform: 'Instagram',
    expected: {
      characterLimit: 2200,
      aspectRatio: '1:1 or 4:5',
      durationLimitSeconds: null,
      fileSizeLimitMb: null,
      acceptedFileFormats: ['JPEG', 'PNG'],
    },
  },
  {
    format: 'carousel',
    platform: 'LinkedIn',
    expected: {
      characterLimit: 3000,
      aspectRatio: null,
      durationLimitSeconds: null,
      fileSizeLimitMb: null,
      acceptedFileFormats: ['JPEG', 'PNG', 'PDF'],
    },
  },
  {
    format: 'single_image_post',
    platform: 'Instagram',
    expected: {
      characterLimit: null,
      aspectRatio: '1:1 or 4:5',
      durationLimitSeconds: null,
      fileSizeLimitMb: 8,
      acceptedFileFormats: ['JPEG', 'PNG'],
    },
  },
  {
    format: 'podcast_episode',
    platform: 'Podcast',
    expected: {
      characterLimit: null,
      aspectRatio: null,
      durationLimitSeconds: null,
      fileSizeLimitMb: 500,
      acceptedFileFormats: ['MP3', 'WAV', 'M4A'],
    },
  },
  {
    format: 'youtube_video',
    platform: 'YouTube',
    expected: {
      characterLimit: null,
      aspectRatio: '16:9',
      durationLimitSeconds: null,
      fileSizeLimitMb: 256000,
      acceptedFileFormats: ['MP4', 'MOV', 'AVI'],
    },
  },
  {
    format: 'story_single',
    platform: 'Instagram',
    expected: {
      characterLimit: null,
      aspectRatio: '9:16',
      durationLimitSeconds: 15,
      fileSizeLimitMb: 30,
      acceptedFileFormats: ['JPEG', 'PNG', 'MP4'],
    },
  },
]

// ─── Property 13 ─────────────────────────────────────────────────────────────

describe('PBT — Constraint Hint Accuracy', () => {
  it(
    'Property 13: every Requirement 16.3 format+platform combination has exact PlatformConstraints values',
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ...(EXPECTED_CONSTRAINTS as [ConstraintTestCase, ...ConstraintTestCase[]]),
          ),
          ({ format, platform, expected }: ConstraintTestCase) => {
            const entry = CONTENT_FORMAT_REGISTRY[format]

            // The registry entry must exist for this format
            expect(entry).toBeDefined()

            const constraints: PlatformConstraints | undefined =
              entry.constraints[platform as StudioPlatform]

            // Constraints must be defined for this format+platform pair
            expect(constraints).toBeDefined()
            expect(constraints).not.toBeNull()

            // Each field must exactly match the specified value
            expect(constraints!.characterLimit).toBe(expected.characterLimit)
            expect(constraints!.aspectRatio).toBe(expected.aspectRatio)
            expect(constraints!.durationLimitSeconds).toBe(expected.durationLimitSeconds)
            expect(constraints!.fileSizeLimitMb).toBe(expected.fileSizeLimitMb)
            expect(constraints!.acceptedFileFormats).toEqual(expected.acceptedFileFormats)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

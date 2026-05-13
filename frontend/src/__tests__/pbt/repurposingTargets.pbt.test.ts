/**
 * Property-Based Tests — Repurposing Target Validity
 *
 * Property 11 (repurposing target validity):
 *   RepurposingTargetSelector only shows valid repurposing paths for the
 *   source format. For any source format, every target format returned by
 *   the selector must be in the REPURPOSING_PATHS[sourceFormat] set.
 *
 * **Validates: Requirements 17.4**
 *
 * Implementation note:
 *   RepurposingTargetSelector derives valid targets from a REPURPOSING_PATHS
 *   map keyed by source ContentFormat. We define that map here (mirroring the
 *   component's logic) and test the derivation as a pure function so no React
 *   environment is needed. Any change to the component's repurposing paths must
 *   be reflected here.
 *
 *   Repurposing path rules (Requirement 17.4):
 *   - text formats   → other text formats, tts_narration, audio_blog
 *   - image formats  → other image formats
 *   - video formats  → other video formats, repurposed_clip
 *   - audio formats  → other audio formats
 *   - story formats  → other story formats
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  CONTENT_FORMAT_REGISTRY,
  CONTENT_FORMATS_PHASE1,
} from '../../constants/contentFormatRegistry'
import type { ContentCategory, ContentFormat } from '../../types'

// ─── Repurposing paths map ────────────────────────────────────────────────────
// Mirrors the logic used by RepurposingTargetSelector (Requirement 17.4).
// For a given source format, returns the set of valid target formats.

/**
 * Returns all formats belonging to a given category (excluding the source
 * format itself, since repurposing to the same format is not useful).
 */
function formatsForCategory(
  category: ContentCategory,
  excludeFormat: ContentFormat,
): ContentFormat[] {
  return CONTENT_FORMATS_PHASE1.filter(
    (f) => CONTENT_FORMAT_REGISTRY[f].category === category && f !== excludeFormat,
  )
}

/**
 * Derives the valid repurposing target formats for a given source format.
 *
 * Rules (Requirement 17.4):
 *   - text   → other text formats + tts_narration + audio_blog
 *   - image  → other image formats
 *   - video  → other video formats + repurposed_clip (if not already in video)
 *   - audio  → other audio formats
 *   - story  → other story formats
 */
function getValidRepurposingTargets(sourceFormat: ContentFormat): ContentFormat[] {
  const sourceCategory = CONTENT_FORMAT_REGISTRY[sourceFormat].category

  switch (sourceCategory) {
    case 'text': {
      const otherTextFormats = formatsForCategory('text', sourceFormat)
      // Add audio cross-format targets (tts_narration, audio_blog) if not already included
      const audioTargets: ContentFormat[] = ['tts_narration', 'audio_blog']
      const combined = new Set([...otherTextFormats, ...audioTargets])
      // Remove the source format itself in case it appeared in audioTargets
      combined.delete(sourceFormat)
      return Array.from(combined)
    }

    case 'image': {
      return formatsForCategory('image', sourceFormat)
    }

    case 'video': {
      const otherVideoFormats = formatsForCategory('video', sourceFormat)
      // repurposed_clip is already a video format, so it will be included above
      // unless sourceFormat === 'repurposed_clip'. Ensure it is always present.
      const combined = new Set([...otherVideoFormats, 'repurposed_clip' as ContentFormat])
      combined.delete(sourceFormat)
      return Array.from(combined)
    }

    case 'audio': {
      return formatsForCategory('audio', sourceFormat)
    }

    case 'story': {
      return formatsForCategory('story', sourceFormat)
    }

    default: {
      return []
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Repurposing Target Validity', () => {
  it(
    'Property 11: for any source format, all valid targets are within the allowed repurposing paths',
    () => {
      /**
       * **Validates: Requirements 17.4**
       *
       * For any source ContentFormat, every target returned by
       * getValidRepurposingTargets must satisfy the repurposing path rules:
       *   - text sources  → targets are text or (tts_narration | audio_blog)
       *   - image sources → targets are image formats
       *   - video sources → targets are video formats
       *   - audio sources → targets are audio formats
       *   - story sources → targets are story formats
       *
       * No target outside the allowed categories/formats may appear.
       */
      fc.assert(
        fc.property(
          fc.constantFrom(...(CONTENT_FORMATS_PHASE1 as [ContentFormat, ...ContentFormat[]])),
          (sourceFormat: ContentFormat) => {
            const sourceCategory = CONTENT_FORMAT_REGISTRY[sourceFormat].category
            const targets = getValidRepurposingTargets(sourceFormat)

            for (const target of targets) {
              const targetCategory = CONTENT_FORMAT_REGISTRY[target].category

              switch (sourceCategory) {
                case 'text':
                  // Targets must be text formats OR the allowed audio cross-formats
                  expect(
                    targetCategory === 'text' ||
                      target === 'tts_narration' ||
                      target === 'audio_blog',
                  ).toBe(true)
                  break

                case 'image':
                  expect(targetCategory).toBe('image')
                  break

                case 'video':
                  expect(targetCategory).toBe('video')
                  break

                case 'audio':
                  expect(targetCategory).toBe('audio')
                  break

                case 'story':
                  expect(targetCategory).toBe('story')
                  break
              }

              // The source format itself must never appear as a target
              expect(target).not.toBe(sourceFormat)
            }
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 11 (non-empty targets): every source format has at least one valid repurposing target',
    () => {
      /**
       * **Validates: Requirements 17.4**
       *
       * Every source format must have at least one valid target — the registry
       * has multiple formats per category, so there is always at least one
       * other format to repurpose to.
       */
      fc.assert(
        fc.property(
          fc.constantFrom(...(CONTENT_FORMATS_PHASE1 as [ContentFormat, ...ContentFormat[]])),
          (sourceFormat: ContentFormat) => {
            const targets = getValidRepurposingTargets(sourceFormat)
            expect(targets.length).toBeGreaterThan(0)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 11 (no cross-category leakage): targets from disallowed categories never appear',
    () => {
      /**
       * **Validates: Requirements 17.4**
       *
       * For image, video, audio, and story source formats, targets from any
       * other category must never appear. This verifies there is no accidental
       * cross-category leakage in the path derivation.
       */
      fc.assert(
        fc.property(
          fc.constantFrom(...(CONTENT_FORMATS_PHASE1 as [ContentFormat, ...ContentFormat[]])).filter(
            (f) => CONTENT_FORMAT_REGISTRY[f].category !== 'text',
          ),
          (sourceFormat: ContentFormat) => {
            const sourceCategory = CONTENT_FORMAT_REGISTRY[sourceFormat].category
            const targets = getValidRepurposingTargets(sourceFormat)

            for (const target of targets) {
              const targetCategory = CONTENT_FORMAT_REGISTRY[target].category
              // For non-text sources, all targets must share the same category
              expect(targetCategory).toBe(sourceCategory)
            }
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

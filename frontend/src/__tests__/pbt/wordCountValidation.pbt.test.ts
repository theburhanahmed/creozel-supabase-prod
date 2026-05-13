/**
 * Property-Based Tests — Custom Word Count Validation
 *
 * Property 12 (custom word count validation):
 *   validateBeforeGenerate returns false (canGenerate is false) when the
 *   length preset is 'custom' and maxWords < minWords.
 *
 * **Validates: Requirements 6.2, 6.3**
 *
 * Implementation note:
 *   validateBeforeGenerate() is an internal method of the useStudioState hook.
 *   Since we cannot render hooks in unit tests without a React environment,
 *   we mirror the exact validation logic from useStudioState.ts as a standalone
 *   function. Any change to the hook's validateBeforeGenerate logic for the
 *   custom word count check must be reflected here.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type {
  ContentFormat,
  LengthConfig,
  RepurposingSource,
  StudioMode,
  StudioValidationErrors,
} from '../../types'

// ─── Mirror of useStudioState's validateBeforeGenerate logic ──────────────────
// This replicates the exact validation logic from useStudioState.ts so the test
// validates the same behaviour without needing to render the hook.

interface ValidateInputs {
  prompt: string
  length: LengthConfig
  mode: StudioMode
  repurposingSource: RepurposingSource | null
  repurposingTarget: ContentFormat | null
}

interface ValidateResult {
  canGenerate: boolean
  errors: StudioValidationErrors
}

function validateBeforeGenerate(inputs: ValidateInputs): ValidateResult {
  const { prompt, length, mode, repurposingSource, repurposingTarget } = inputs
  const errors: StudioValidationErrors = {}

  if (prompt.trim().length === 0) {
    errors.prompt = 'Prompt is required'
  } else if (prompt.length > 4000) {
    errors.prompt = 'Prompt exceeds 4,000 characters'
  }

  if (
    length.preset === 'custom' &&
    length.maxWords !== null &&
    length.minWords !== null &&
    length.maxWords < length.minWords
  ) {
    errors.length = 'Maximum word count must be ≥ minimum'
  }

  if (mode === 'repurpose') {
    if (!repurposingSource) {
      errors.repurposingSource = 'Please select a source asset'
    }
    if (!repurposingTarget) {
      errors.repurposingTarget = 'Please select a target format'
    }
  }

  return {
    canGenerate: Object.keys(errors).length === 0,
    errors,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Custom Word Count Validation', () => {
  it(
    'Property 12: validateBeforeGenerate returns canGenerate === false when preset is custom and maxWords < minWords',
    () => {
      /**
       * **Validates: Requirements 6.2, 6.3**
       *
       * For any (minWords, maxWords) pair where maxWords < minWords, and the
       * length preset is 'custom', validateBeforeGenerate must set a length
       * error and return canGenerate=false. This holds regardless of all other
       * inputs being valid (non-empty prompt within 4000 chars, create mode).
       */
      fc.assert(
        fc.property(
          // Generate (minWords, maxWords) pairs where maxWords < minWords
          fc
            .tuple(
              fc.integer({ min: 1, max: 10000 }),
              fc.integer({ min: 1, max: 10000 }),
            )
            .filter(([min, max]) => max < min),
          ([minWords, maxWords]: [number, number]) => {
            // Precondition: maxWords is strictly less than minWords
            expect(maxWords).toBeLessThan(minWords)

            const length: LengthConfig = {
              preset: 'custom',
              minWords,
              maxWords,
              durationSeconds: null,
              quantity: null,
              speakingRate: null,
            }

            const result = validateBeforeGenerate({
              // Use a valid prompt so only the word count triggers the failure
              prompt: 'A valid prompt for testing purposes',
              length,
              mode: 'create',
              repurposingSource: null,
              repurposingTarget: null,
            })

            // canGenerate must be false when maxWords < minWords with custom preset
            expect(result.canGenerate).toBe(false)

            // The length error must be set
            expect(result.errors.length).toBeDefined()
            expect(result.errors.length).not.toBe('')
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 12 (boundary): canGenerate is true when maxWords === minWords with custom preset',
    () => {
      /**
       * **Validates: Requirements 6.2, 6.3**
       *
       * When maxWords exactly equals minWords the range is valid (zero-width
       * range), so canGenerate must be true. This validates the boundary
       * condition of the < comparison.
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (wordCount: number) => {
            const length: LengthConfig = {
              preset: 'custom',
              minWords: wordCount,
              maxWords: wordCount,
              durationSeconds: null,
              quantity: null,
              speakingRate: null,
            }

            const result = validateBeforeGenerate({
              prompt: 'A valid prompt for testing purposes',
              length,
              mode: 'create',
              repurposingSource: null,
              repurposingTarget: null,
            })

            // Equal min/max is valid — no length error
            expect(result.errors.length).toBeUndefined()
            // canGenerate must be true (no other errors present)
            expect(result.canGenerate).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 12 (non-custom preset): word count inversion does not trigger error for non-custom presets',
    () => {
      /**
       * **Validates: Requirements 6.2, 6.3**
       *
       * The maxWords < minWords check only applies when preset === 'custom'.
       * For any other preset (short, medium, long, null), even if minWords and
       * maxWords are set to an inverted range, no length error should be raised.
       */
      fc.assert(
        fc.property(
          fc.constantFrom('short', 'medium', 'long', null as null),
          fc
            .tuple(
              fc.integer({ min: 1, max: 10000 }),
              fc.integer({ min: 1, max: 10000 }),
            )
            .filter(([min, max]) => max < min),
          (preset, [minWords, maxWords]: [number, number]) => {
            const length: LengthConfig = {
              preset,
              minWords,
              maxWords,
              durationSeconds: null,
              quantity: null,
              speakingRate: null,
            }

            const result = validateBeforeGenerate({
              prompt: 'A valid prompt for testing purposes',
              length,
              mode: 'create',
              repurposingSource: null,
              repurposingTarget: null,
            })

            // Non-custom presets must not trigger the word count validation
            expect(result.errors.length).toBeUndefined()
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 12 (null word counts): no error when minWords or maxWords is null with custom preset',
    () => {
      /**
       * **Validates: Requirements 6.2, 6.3**
       *
       * The validation only fires when both minWords and maxWords are non-null.
       * When either is null the check is skipped and no length error is raised.
       */
      fc.assert(
        fc.property(
          fc.oneof(
            // minWords null, maxWords any value
            fc.record({
              minWords: fc.constant(null as null),
              maxWords: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
            }),
            // maxWords null, minWords any value
            fc.record({
              minWords: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
              maxWords: fc.constant(null as null),
            }),
          ),
          ({ minWords, maxWords }) => {
            const length: LengthConfig = {
              preset: 'custom',
              minWords,
              maxWords,
              durationSeconds: null,
              quantity: null,
              speakingRate: null,
            }

            const result = validateBeforeGenerate({
              prompt: 'A valid prompt for testing purposes',
              length,
              mode: 'create',
              repurposingSource: null,
              repurposingTarget: null,
            })

            // Null word counts must not trigger the length validation error
            expect(result.errors.length).toBeUndefined()
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

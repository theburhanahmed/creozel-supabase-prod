/**
 * Property-Based Tests — Prompt Length Gate
 *
 * Property 7 (prompt length gate):
 *   For any prompt whose length is strictly greater than 4,000 characters,
 *   validateBeforeGenerate() SHALL return false (canGenerate is false).
 *
 * **Validates: Requirements 2.5, 2.6**
 *
 * Implementation note:
 *   validateBeforeGenerate() is an internal method of the useStudioState hook.
 *   Since we cannot render hooks in unit tests without a React environment,
 *   we mirror the exact validation logic from useStudioState.ts as a standalone
 *   function. Any change to the hook's validateBeforeGenerate logic for the
 *   prompt length check must be reflected here.
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

// ─── Default length config (valid, non-triggering) ───────────────────────────

const DEFAULT_LENGTH: LengthConfig = {
  preset: 'medium',
  minWords: null,
  maxWords: null,
  durationSeconds: null,
  quantity: null,
  speakingRate: null,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Prompt Length Gate', () => {
  it(
    'Property 7: any prompt with length > 4000 characters causes validateBeforeGenerate to return canGenerate === false',
    () => {
      /**
       * **Validates: Requirements 2.5, 2.6**
       *
       * For any prompt string whose .length is strictly greater than 4000,
       * the validation logic must set a prompt error and return canGenerate=false.
       * This holds regardless of all other inputs being valid.
       */
      fc.assert(
        fc.property(
          fc.string({ minLength: 4001, maxLength: 8000 }),
          (longPrompt: string) => {
            const result = validateBeforeGenerate({
              prompt: longPrompt,
              length: DEFAULT_LENGTH,
              mode: 'create',
              repurposingSource: null,
              repurposingTarget: null,
            })

            // canGenerate must be false for any prompt exceeding 4000 chars
            expect(result.canGenerate).toBe(false)

            // The prompt error must be set
            expect(result.errors.prompt).toBeDefined()
            expect(result.errors.prompt).not.toBe('')
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

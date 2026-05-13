/**
 * Property-Based Tests — Credits Gate
 *
 * Property 8 (insufficient credits gate):
 *   For any configuration where estimatedCost > balance (both non-null),
 *   canGenerate SHALL be false.
 *
 * **Validates: Requirements 9.5, 9.6**
 *
 * Implementation note:
 *   The credits gate is a UI-level check in the StudioActions component.
 *   We test the gate logic directly as a standalone pure function that mirrors
 *   the exact condition used in StudioActions to derive the canGenerate prop.
 *   Any change to the StudioActions credits gate condition must be reflected here.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// ─── Mirror of StudioActions' credits gate logic ──────────────────────────────
// This replicates the exact gate condition from StudioActions.tsx so the test
// validates the same behaviour without needing to render the component.
//
// Logic:
//   - If either estimatedCost or balance is null, cost is unknown → allow (return true)
//   - Otherwise, canGenerate only when estimatedCost <= balance

function canGenerate(estimatedCost: number | null, balance: number | null): boolean {
  if (estimatedCost === null || balance === null) return true // unknown cost = allow
  return estimatedCost <= balance
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — Credits Gate', () => {
  it(
    'Property 8: canGenerate is false for any (estimatedCost, balance) where estimatedCost > balance (both non-null)',
    () => {
      /**
       * **Validates: Requirements 9.5, 9.6**
       *
       * For any pair of non-null numbers where estimatedCost strictly exceeds
       * balance, the credits gate must return false. This holds regardless of
       * the magnitude of either value.
       */
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
              fc.float({ min: Math.fround(0), max: Math.fround(9999.99), noNaN: true }),
            )
            .filter(([cost, bal]) => cost > bal),
          ([estimatedCost, balance]: [number, number]) => {
            // Precondition: estimatedCost strictly exceeds balance
            expect(estimatedCost).toBeGreaterThan(balance)

            // The gate must block generation when cost exceeds balance
            expect(canGenerate(estimatedCost, balance)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 8 (boundary): canGenerate is true when estimatedCost === balance (exact funds)',
    () => {
      /**
       * **Validates: Requirements 9.5, 9.6**
       *
       * When estimatedCost exactly equals balance the user has sufficient funds,
       * so canGenerate must be true. This validates the boundary condition of
       * the <= comparison.
       */
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
          (amount: number) => {
            expect(canGenerate(amount, amount)).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 8 (null passthrough): canGenerate is true when either value is null',
    () => {
      /**
       * **Validates: Requirements 9.5, 9.6**
       *
       * When the cost estimate or balance is unavailable (null), the gate must
       * not block generation — the cost is simply unknown.
       */
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null as null),
            fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
          ),
          fc.oneof(
            fc.constant(null as null),
            fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
          ),
          (cost: number | null, bal: number | null) => {
            // Only test cases where at least one value is null
            fc.pre(cost === null || bal === null)
            expect(canGenerate(cost, bal)).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

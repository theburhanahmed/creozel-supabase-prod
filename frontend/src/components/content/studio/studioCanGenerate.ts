/**
 * studioCanGenerate.ts
 *
 * Centralises the `canGenerate` gate logic for the Studio's Generate button.
 *
 * This utility is consumed by ConfigurationPanel (task 15) to compute the
 * `canGenerate` prop passed to <StudioActions>.
 *
 * Gate conditions (ALL must be true for canGenerate === true):
 *
 *  1. Credit estimate is NOT loading (Requirement 9.7)
 *     — While useCreditEstimate.isLoading is true the cost is unknown;
 *       submitting would risk an unexpected deduction.
 *
 *  2. Credit estimate is NOT unavailable (Requirement 9.3 / 9.5)
 *     — When isUnavailable is true we cannot verify the user can afford the
 *       job, so generation is blocked.
 *
 *  3. estimatedCost <= balance (Requirement 9.5)
 *     — When the cost exceeds the balance the Generate button is replaced by
 *       a "Top Up Credits" link in CreditEstimateBar; StudioActions must also
 *       be disabled to prevent keyboard-only bypass.
 *     — When either value is null (balance not yet loaded) we treat it as
 *       insufficient to be safe.
 *
 *  4. No validation errors exist (Requirements 2.4, 2.5, 6.2, 10.9)
 *     — useStudioState.validationErrors must be an empty object.
 *
 *  5. Prompt is non-empty (Requirement 2.4)
 *     — Checked here as a fast-path guard; validateBeforeGenerate() also
 *       covers this, but canGenerate must reflect it reactively.
 *
 * Usage in ConfigurationPanel (task 15):
 *
 *   import { computeCanGenerate } from './studioCanGenerate'
 *   import { useCreditEstimate } from '../../../hooks/useCreditEstimate'
 *   import { useStudioState } from '../../../hooks/useStudioState'
 *
 *   const studio = useStudioState(activeTeam?.id ?? null)
 *   const { estimatedCost, isLoading: creditLoading, isUnavailable } =
 *     useCreditEstimate(studio.contentCategory, studio.contentFormat, studio.buildMetadata().advancedOptions)
 *
 *   const canGenerate = computeCanGenerate({
 *     creditIsLoading: creditLoading,
 *     creditIsUnavailable: isUnavailable,
 *     estimatedCost,
 *     balance,          // from useAppContext() or wallet fetch
 *     validationErrors: studio.validationErrors,
 *     prompt: studio.prompt,
 *   })
 *
 *   <CreditEstimateBar
 *     estimatedCost={estimatedCost}
 *     balance={balance}
 *     isLoading={creditLoading}
 *     isUnavailable={isUnavailable}
 *   />
 *   <StudioActions
 *     canGenerate={canGenerate}
 *     isGenerating={studio.isGenerating}
 *     onGenerate={handleGenerate}
 *     onSaveAsPipeline={handleSaveAsPipeline}
 *   />
 */

import type { StudioValidationErrors } from '../../../types'

export interface ComputeCanGenerateParams {
  /** True while useCreditEstimate is fetching/recalculating (Req 9.7). */
  creditIsLoading: boolean
  /** True when the pricing fetch failed and no estimate is available (Req 9.3). */
  creditIsUnavailable: boolean
  /** Estimated credit cost, or null when unavailable. */
  estimatedCost: number | null
  /** User's current credit balance, or null when not yet loaded. */
  balance: number | null
  /** Current validation errors from useStudioState. */
  validationErrors: StudioValidationErrors
  /** Current prompt value from useStudioState. */
  prompt: string
}

/**
 * Returns true when all gate conditions for the Generate button are satisfied.
 *
 * This is a pure function so it can be unit-tested independently of React.
 */
export function computeCanGenerate({
  creditIsLoading,
  creditIsUnavailable,
  estimatedCost,
  balance,
  validationErrors,
  prompt,
}: ComputeCanGenerateParams): boolean {
  // Gate 1 — Req 9.7: block while credit estimate is loading
  if (creditIsLoading) return false

  // Gate 2 — Req 9.3: block when estimate is unavailable (can't verify cost)
  if (creditIsUnavailable) return false

  // Gate 3 — Req 9.5: block when cost exceeds balance or either is unknown
  if (estimatedCost === null || balance === null) return false
  if (estimatedCost > balance) return false

  // Gate 4 — Req 2.4 / 10.9: block when any validation error is present
  if (Object.keys(validationErrors).length > 0) return false

  // Gate 5 — Req 2.4: block when prompt is empty (reactive fast-path)
  if (prompt.trim().length === 0) return false

  return true
}

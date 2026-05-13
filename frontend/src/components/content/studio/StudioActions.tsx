import React, { useCallback } from 'react'
import { Loader2Icon, PlayIcon, WorkflowIcon } from 'lucide-react'
import { Button } from '../../ui/Button'

/**
 * Props for StudioActions.
 *
 * Matches the interface defined in design.md §Props Interfaces.
 */
export interface StudioActionsProps {
  /** Whether all validation conditions are met and generation can proceed. */
  canGenerate: boolean
  /** True while a generation job is in progress. */
  isGenerating: boolean
  /** Called when the user clicks Generate or presses Enter on the button. */
  onGenerate: () => void
  /** Called when the user clicks Save as Pipeline. */
  onSaveAsPipeline: () => void
}

/**
 * StudioActions
 *
 * Renders the Generate and Save as Pipeline action buttons side by side at the
 * bottom of the Configuration Panel.
 *
 * Behaviour:
 * - Generate button is disabled when `canGenerate` is false OR `isGenerating`
 *   is true (Requirements 10.1, 10.2).
 * - While `isGenerating` is true the Generate button shows a spinner loading
 *   indicator in place of the play icon (Requirement 10.2).
 * - The Generate button responds to the Enter key so keyboard-only users can
 *   trigger generation without reaching for the mouse.
 * - Save as Pipeline button is always enabled and rendered alongside Generate
 *   (Requirement 12.1).
 *
 * Accessibility:
 * - Both buttons carry descriptive aria-label attributes.
 * - aria-disabled is set on the Generate button when it cannot be activated,
 *   in addition to the native `disabled` attribute, for maximum screen-reader
 *   compatibility.
 * - aria-busy is set on the Generate button while generation is in progress.
 *
 * Wiring (Requirement 9.7 — task 11.5):
 * The `canGenerate` prop MUST be computed via `computeCanGenerate()` from
 * `./studioCanGenerate`. That function gates on ALL of the following:
 *   - useCreditEstimate.isLoading === false  (Req 9.7 — primary gate)
 *   - useCreditEstimate.isUnavailable === false
 *   - estimatedCost <= balance (both non-null)
 *   - useStudioState.validationErrors is empty
 *   - prompt is non-empty
 *
 * ConfigurationPanel (task 15) is responsible for calling useCreditEstimate
 * and useStudioState, computing canGenerate, and passing it here.
 * See studioCanGenerate.ts for the full usage example.
 */
export const StudioActions: React.FC<StudioActionsProps> = ({
  canGenerate,
  isGenerating,
  onGenerate,
  onSaveAsPipeline,
}) => {
  const isGenerateDisabled = !canGenerate || isGenerating

  /**
   * Handle keydown on the Generate button.
   * The button already responds to Space/Enter natively, but we add an
   * explicit Enter handler to satisfy the requirement that the button is
   * "activatable via Enter key" even when focus management is customised.
   */
  const handleGenerateKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' && !isGenerateDisabled) {
        e.preventDefault()
        onGenerate()
      }
    },
    [isGenerateDisabled, onGenerate],
  )

  return (
    <div
      className="flex items-center gap-3 flex-wrap"
      role="group"
      aria-label="Studio actions"
    >
      {/* ── Generate button ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onGenerate}
        onKeyDown={handleGenerateKeyDown}
        disabled={isGenerateDisabled}
        aria-disabled={isGenerateDisabled}
        aria-busy={isGenerating}
        aria-label={
          isGenerating
            ? 'Generating content, please wait…'
            : isGenerateDisabled
              ? 'Generate — complete all required fields to enable'
              : 'Generate content'
        }
        className={[
          // Base layout — matches Button primary variant sizing
          'inline-flex items-center justify-center gap-2',
          'px-5 py-2.5 rounded-xl text-sm font-semibold',
          'transition-all duration-200 select-none outline-none',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3FE0A5]',
          'active:scale-[0.98]',
          // Enabled state: primary gradient
          !isGenerateDisabled
            ? 'bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white shadow-md hover:brightness-105 hover:shadow-lg'
            : 'bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white shadow-md opacity-50 cursor-not-allowed',
        ].join(' ')}
      >
        {isGenerating ? (
          <>
            <Loader2Icon
              size={16}
              aria-hidden="true"
              className="animate-spin shrink-0"
            />
            <span>Generating…</span>
          </>
        ) : (
          <>
            <PlayIcon size={16} aria-hidden="true" className="shrink-0" />
            <span>Generate</span>
          </>
        )}
      </button>

      {/* ── Save as Pipeline button ──────────────────────────────────────── */}
      <Button
        type="button"
        variant="outline"
        size="md"
        leftIcon={<WorkflowIcon size={15} aria-hidden="true" />}
        onClick={onSaveAsPipeline}
        aria-label="Save current configuration as a reusable pipeline"
      >
        Save as Pipeline
      </Button>
    </div>
  )
}

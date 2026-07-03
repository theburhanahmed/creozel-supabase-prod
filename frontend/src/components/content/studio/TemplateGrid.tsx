import React, { useCallback } from 'react'
import { Loader2Icon, AlertCircleIcon, LayoutGridIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useTemplates } from '../../../hooks/useTemplates'
import { deleteTemplate } from '../../../services/studioService'
import { TemplateCard } from './TemplateCard'
import type { ContentCategory, StudioPlatform, StudioTemplate } from '../../../types'

export interface TemplateGridProps {
  teamId: string
  categoryFilter: ContentCategory | 'all'
  platformFilter: StudioPlatform | 'all'
  onApply: (template: StudioTemplate) => void
  onDelete?: (templateId: string) => void
}

/**
 * TemplateGrid
 *
 * Fetches all templates visible to the team via `useTemplates`, applies the
 * category and platform filters, and renders a responsive grid of TemplateCard
 * components.
 *
 * States handled:
 * - Loading: spinner with accessible label
 * - Error: error message with retry button
 * - Empty (no templates at all): generic empty state
 * - Empty (filters produce no matches): "No templates match your filters"
 *   message (Requirement 8.4)
 * - Populated: grid of TemplateCard components
 *
 * The delete button is only passed to TemplateCard for user-saved templates
 * (is_system === false), satisfying Requirement 8.9.
 *
 * On delete confirmation, TemplateGrid calls studioService.deleteTemplate and
 * optimistically removes the card from the grid. If the service call fails,
 * it triggers a refetch to restore the correct state (Requirement 8.9).
 *
 * When a template card is clicked, TemplateGrid calls the parent's onApply
 * callback and shows a toast notification identifying the applied template
 * name, which auto-dismisses after 4 seconds (Requirement 8.6).
 *
 * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.9
 */
export const TemplateGrid: React.FC<TemplateGridProps> = ({
  teamId,
  categoryFilter,
  platformFilter,
  onApply,
  onDelete,
}) => {
  const { templates, isLoading, error, refetch } = useTemplates(
    teamId,
    categoryFilter,
    platformFilter,
  )

  /**
   * Handle confirmed deletion:
   * 1. Call studioService.deleteTemplate (service call)
   * 2. On success: trigger refetch so the hook removes the card from state
   * 3. On failure: trigger refetch to restore correct state
   * 4. Also call the optional external onDelete prop for parent notification
   */
  const handleDelete = useCallback(
    async (templateId: string) => {
      const success = await deleteTemplate(templateId, teamId)
      if (success) {
        // Notify parent if provided (e.g. for toast notifications)
        onDelete?.(templateId)
      }
      // Refetch regardless — on success this removes the card; on failure
      // this restores any optimistic state
      refetch()
    },
    [onDelete, refetch, teamId],
  )

  /**
   * Handle template application:
   * 1. Call the parent's onApply callback (which calls useStudioState.applyTemplate)
   * 2. Show a toast notification with the template name that auto-dismisses
   *    after 4 seconds (within the 3–5 second range per Requirement 8.6)
   */
  const handleApply = useCallback(
    (template: StudioTemplate) => {
      onApply(template)
      toast.success(`Template "${template.name}" applied`, { duration: 4000 })
    },
    [onApply],
  )

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-10 text-gray-400 dark:text-gray-500"
        role="status"
        aria-label="Loading templates"
      >
        <Loader2Icon size={18} className="animate-spin shrink-0" aria-hidden="true" />
        <span className="text-sm">Loading templates…</span>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-10 text-center"
        role="alert"
        aria-live="polite"
      >
        <AlertCircleIcon
          size={24}
          className="text-red-400 dark:text-red-500 shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Failed to load templates.
        </p>
        <button
          type="button"
          onClick={refetch}
          className={[
            'text-xs font-medium px-3 py-1.5 rounded-lg',
            'border border-gray-200 dark:border-white/20',
            'text-gray-600 dark:text-gray-300',
            'hover:bg-gray-50 dark:hover:bg-white/5',
            'transition-colors duration-150 outline-none',
            'focus-visible:ring-2 focus-visible:ring-[#3FE0A5]',
          ].join(' ')}
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Empty state — no templates exist at all ────────────────────────────────

  if (templates.length === 0 && categoryFilter === 'all' && platformFilter === 'all') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 py-10 text-center"
        aria-live="polite"
      >
        <LayoutGridIcon
          size={24}
          className="text-gray-300 dark:text-gray-600 shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No templates available yet.
        </p>
      </div>
    )
  }

  // ── Empty state — filters produce no matches (Requirement 8.4) ────────────

  if (templates.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 py-10 text-center"
        aria-live="polite"
      >
        <LayoutGridIcon
          size={24}
          className="text-gray-300 dark:text-gray-600 shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No templates match your filters.
        </p>
      </div>
    )
  }

  // ── Populated grid ─────────────────────────────────────────────────────────

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
      role="list"
      aria-label="Template library"
    >
      {templates.map((template) => (
        <div key={template.id} role="listitem">
          <TemplateCard
            template={template}
            onApply={handleApply}
            // Only pass onDelete for user-saved templates (Requirement 8.9)
            onDelete={!template.is_system ? handleDelete : undefined}
          />
        </div>
      ))}
    </div>
  )
}

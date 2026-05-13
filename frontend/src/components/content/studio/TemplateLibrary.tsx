import React, { useCallback, useState } from 'react'
import { BookmarkPlusIcon, LayoutGridIcon } from 'lucide-react'
import { Button } from '../../ui/Button'
import { TemplateFilters } from './TemplateFilters'
import { TemplateGrid } from './TemplateGrid'
import { SaveAsTemplateModal } from './SaveAsTemplateModal'
import type {
  ContentCategory,
  StudioDraftConfig,
  StudioPlatform,
  StudioTemplate,
} from '../../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TemplateLibraryProps {
  /** The active team's ID — passed down to TemplateGrid and SaveAsTemplateModal. */
  teamId: string
  /** Called when the user clicks a template card to apply it. */
  onApply: (template: StudioTemplate) => void
  /**
   * The current Studio draft configuration — required by SaveAsTemplateModal
   * so it can capture the prompt, category, format, platform, tone, and length
   * when the user saves a new template (Requirement 8.7, 8.8).
   */
  currentConfig: StudioDraftConfig
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * TemplateLibrary
 *
 * Container component for the Template Library section of the Configuration
 * Panel. It:
 *
 * 1. Manages the category and platform filter state internally.
 * 2. Renders TemplateFilters above TemplateGrid (Requirement 8.4).
 * 3. Renders a "Save as Template" button that opens SaveAsTemplateModal
 *    (Requirement 8.7).
 * 4. Passes `teamId` and `onApply` down to TemplateGrid and
 *    SaveAsTemplateModal (Requirement 8.3, 8.8).
 * 5. On successful template save, adds the new template to the grid by
 *    triggering a refetch via the `onSaved` callback from SaveAsTemplateModal.
 *
 * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9
 */
export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  teamId,
  onApply,
  currentConfig,
}) => {
  // ── Filter state (owned here, passed down to TemplateFilters + TemplateGrid)

  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState<StudioPlatform | 'all'>('all')

  // ── Modal state ────────────────────────────────────────────────────────────

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleOpenSaveModal = useCallback(() => {
    setIsSaveModalOpen(true)
  }, [])

  const handleCloseSaveModal = useCallback(() => {
    setIsSaveModalOpen(false)
  }, [])

  /**
   * Called by SaveAsTemplateModal after a successful save.
   * The TemplateGrid's useTemplates hook will refetch automatically because
   * the new template is now in the DB. We close the modal here; the grid
   * refreshes on its own via the hook's internal refetch mechanism.
   */
  const handleTemplateSaved = useCallback(
    (_template: StudioTemplate) => {
      setIsSaveModalOpen(false)
    },
    [],
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Template library"
      className="flex flex-col gap-4"
    >
      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutGridIcon
            size={16}
            className="text-[#3FE0A5] shrink-0"
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Templates
          </h3>
        </div>

        {/* ── Save as Template button (Requirement 8.7) ─────────────────── */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<BookmarkPlusIcon size={14} aria-hidden="true" />}
          onClick={handleOpenSaveModal}
          aria-label="Save current Studio configuration as a new template"
        >
          Save as Template
        </Button>
      </div>

      {/* ── Filters (Requirement 8.4) ─────────────────────────────────────── */}
      <TemplateFilters
        categoryFilter={categoryFilter}
        platformFilter={platformFilter}
        onCategoryChange={setCategoryFilter}
        onPlatformChange={setPlatformFilter}
      />

      {/* ── Template grid (Requirements 8.1, 8.3, 8.5, 8.6, 8.9) ─────────── */}
      <TemplateGrid
        teamId={teamId}
        categoryFilter={categoryFilter}
        platformFilter={platformFilter}
        onApply={onApply}
      />

      {/* ── Save as Template modal (Requirements 8.7, 8.8) ───────────────── */}
      <SaveAsTemplateModal
        isOpen={isSaveModalOpen}
        currentConfig={currentConfig}
        teamId={teamId}
        onClose={handleCloseSaveModal}
        onSaved={handleTemplateSaved}
      />
    </section>
  )
}

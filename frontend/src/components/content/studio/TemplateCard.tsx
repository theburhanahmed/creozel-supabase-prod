import React, { useCallback, useState } from 'react'
import { Trash2Icon } from 'lucide-react'
import type { StudioTemplate } from '../../../types'

export interface TemplateCardProps {
  template: StudioTemplate
  onApply: (template: StudioTemplate) => void
  onDelete?: (templateId: string) => void // only for user-saved templates
}

// ─── Category accent colours (matches ContentCategoryTabs palette) ────────────

const CATEGORY_CLASSES: Record<string, string> = {
  text: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  image: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30',
  video: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  audio: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
  story: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
}

const CATEGORY_LABELS: Record<string, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  story: 'Story',
}

/**
 * TemplateCard
 *
 * Displays a single Studio template with:
 * - Name (bold heading)
 * - Description (muted, clamped to 2 lines)
 * - Content category badge (colour-coded)
 * - Platform badge
 * - Delete button (only for user-saved templates, i.e. is_system === false)
 *
 * Clicking anywhere on the card (except the delete button) calls onApply.
 * Clicking the delete button shows an inline confirmation prompt ("Delete?")
 * with Yes/No buttons. Confirming calls onDelete; cancelling dismisses the
 * prompt with no changes (Requirement 8.9).
 *
 * Accessibility:
 * - The card is a <button> so it is natively tab-navigable and activatable
 *   via Enter or Space.
 * - The delete button has an aria-label and stops propagation so it does not
 *   also trigger onApply.
 *
 * Requirements: 8.1, 8.3, 8.9
 */
export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onApply,
  onDelete,
}) => {
  const isUserSaved = !template.is_system
  const [isConfirming, setIsConfirming] = useState(false)

  const handleApply = useCallback(() => {
    onApply(template)
  }, [onApply, template])

  // First click: show confirmation prompt
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      setIsConfirming(true)
    },
    [],
  )

  // Confirm: call onDelete and reset confirmation state
  const handleConfirmDelete = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      setIsConfirming(false)
      onDelete?.(template.id)
    },
    [onDelete, template.id],
  )

  // Cancel: dismiss prompt with no changes
  const handleCancelDelete = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      setIsConfirming(false)
    },
    [],
  )

  const handleDeleteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Prevent the card's keydown from also firing
      e.stopPropagation()
      // Allow Escape to cancel the confirmation
      if (e.key === 'Escape') {
        setIsConfirming(false)
      }
    },
    [],
  )

  const categoryClasses =
    CATEGORY_CLASSES[template.content_category] ??
    'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-300/30'

  const categoryLabel =
    CATEGORY_LABELS[template.content_category] ?? template.content_category

  return (
    <div className="relative group">
      {/* ── Main card button ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleApply}
        aria-label={`Apply template: ${template.name}`}
        className={[
          'w-full text-left flex flex-col gap-2.5 p-4 rounded-xl border',
          'transition-all duration-200 select-none outline-none',
          'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3FE0A5]',
          'glass-light border-transparent',
          'hover:border-gray-200 dark:hover:border-white/20 hover:shadow-sm',
          // Extra right padding when delete button is visible so text doesn't
          // overlap the absolutely-positioned delete button
          isUserSaved ? 'pr-10' : '',
        ].join(' ')}
      >
        {/* Name */}
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
          {template.name}
        </span>

        {/* Description */}
        {template.description && (
          <span className="text-xs text-gray-500 dark:text-gray-400 leading-snug line-clamp-2">
            {template.description}
          </span>
        )}

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {/* Content category badge */}
          <span
            className={[
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold',
              'border leading-none uppercase tracking-wide',
              categoryClasses,
            ].join(' ')}
            aria-label={`Category: ${categoryLabel}`}
          >
            {categoryLabel}
          </span>

          {/* Platform badge */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium leading-none
              bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400"
            aria-label={`Platform: ${template.platform}`}
          >
            {template.platform}
          </span>

          {/* System badge */}
          {template.is_system && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium leading-none
                bg-[#3FE0A5]/10 text-emerald-700 dark:text-emerald-300"
              aria-label="System template"
            >
              System
            </span>
          )}
        </div>
      </button>

      {/* ── Delete button (user-saved templates only) ─────────────────────── */}
      {isUserSaved && onDelete && (
        <>
          {isConfirming ? (
            /* ── Inline confirmation prompt ─────────────────────────────── */
            <div
              className={[
                'absolute top-2 right-2',
                'flex items-center gap-1.5 px-2 py-1.5 rounded-lg',
                'bg-white dark:bg-gray-800 border border-red-200 dark:border-red-500/30',
                'shadow-sm',
              ].join(' ')}
              role="group"
              aria-label="Confirm delete"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                Delete?
              </span>
              <button
                type="button"
                onClick={handleConfirmDelete}
                onKeyDown={handleDeleteKeyDown}
                aria-label="Confirm delete template"
                className={[
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                  'bg-red-500 text-white',
                  'hover:bg-red-600',
                  'transition-colors duration-150 outline-none',
                  'focus-visible:ring-2 focus-visible:ring-red-400',
                ].join(' ')}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                onKeyDown={handleDeleteKeyDown}
                aria-label="Cancel delete template"
                className={[
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                  'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300',
                  'hover:bg-gray-200 dark:hover:bg-white/20',
                  'transition-colors duration-150 outline-none',
                  'focus-visible:ring-2 focus-visible:ring-gray-400',
                ].join(' ')}
              >
                No
              </button>
            </div>
          ) : (
            /* ── Trash icon button ──────────────────────────────────────── */
            <button
              type="button"
              onClick={handleDeleteClick}
              onKeyDown={handleDeleteKeyDown}
              aria-label={`Delete template: ${template.name}`}
              className={[
                'absolute top-3 right-3',
                'p-1.5 rounded-lg',
                'text-gray-400 dark:text-gray-500',
                'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                'hover:text-red-500 dark:hover:text-red-400',
                'hover:bg-red-50 dark:hover:bg-red-500/10',
                'transition-all duration-150 outline-none',
                'focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-400',
              ].join(' ')}
            >
              <Trash2Icon size={14} aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  )
}

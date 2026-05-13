import React, { useCallback, useEffect, useId, useState } from 'react'
import { BookmarkIcon, Loader2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../ui/Button'
import type { StudioDraftConfig, StudioTemplate } from '../../../types'
import { saveTemplate } from '../../../services/studioService'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SaveAsTemplateModalProps {
  isOpen: boolean
  currentConfig: StudioDraftConfig
  teamId: string
  onClose: () => void
  onSaved: (template: StudioTemplate) => void
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  name: string
  description: string
}

interface FormErrors {
  name?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SaveAsTemplateModal
 *
 * Collects a template name (required, 1–100 chars) and an optional description
 * (0–500 chars) with inline validation errors. On submit calls
 * studioService.saveTemplate with the current Studio config. On success shows
 * a success toast and closes the modal (calling onSaved and onClose). On
 * failure shows an error toast and keeps the modal open with all values
 * preserved.
 *
 * Requirements: 8.7, 8.8
 */
export const SaveAsTemplateModal: React.FC<SaveAsTemplateModalProps> = ({
  isOpen,
  currentConfig,
  teamId,
  onClose,
  onSaved,
}) => {
  const nameId = useId()
  const descId = useId()

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({ name: '', description: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', description: '' })
      setErrors({})
      setIsSubmitting(false)
    }
  }, [isOpen])

  // ── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  // ── Field handlers ─────────────────────────────────────────────────────────
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setForm((prev) => ({ ...prev, name: value }))
      // Clear name error as user types
      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
    },
    [errors.name],
  )

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= 500) setForm((prev) => ({ ...prev, description: value }))
  }, [])

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}
    const trimmedName = form.name.trim()

    if (!trimmedName) {
      newErrors.name = 'Template name is required.'
    } else if (trimmedName.length > 100) {
      newErrors.name = 'Template name must be 100 characters or fewer.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form.name])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      setIsSubmitting(true)

      // Req 8.8 — insert a row into studio_templates capturing the current
      // prompt, content type, platform, tone, length, and advanced options.
      const result = await saveTemplate(teamId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        contentCategory: currentConfig.contentCategory,
        contentFormat: currentConfig.contentFormat,
        platform: currentConfig.platform,
        tone: currentConfig.tone,
        promptTemplate: currentConfig.prompt,
        advancedOptions: {
          model: null,
          resolution: null,
          style: null,
          negativePrompt: null,
          seed: null,
          voice: null,
          pitch: null,
          stability: null,
          outputFormat: null,
          aspectRatio: null,
          includeBRoll: null,
          brandVoice: null,
          language: null,
        },
      })

      setIsSubmitting(false)

      if (result) {
        // Req 8.7 — success: show toast, call onSaved, and close modal
        toast.success('Template saved successfully!')
        onSaved(result)
        onClose()
      } else {
        // Req 8.7 — failure: show error toast, keep modal open with values preserved
        toast.error('Failed to save template. Please try again.')
      }
    },
    [validate, teamId, form, currentConfig, onSaved, onClose],
  )

  // ── Render guard ───────────────────────────────────────────────────────────
  if (!isOpen) return null

  const nameLength = form.name.length
  const descLength = form.description.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-template-title"
    >
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isSubmitting ? onClose : undefined}
        aria-hidden="true"
      />

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3FE0A5]/20 to-[#38B897]/10 flex items-center justify-center">
              <BookmarkIcon size={16} className="text-[#3FE0A5]" aria-hidden="true" />
            </div>
            <h2
              id="save-template-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              Save as Template
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5]"
          >
            <XIcon size={18} aria-hidden="true" />
          </button>
        </div>

        {/* ── Form ────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 flex flex-col gap-5">

            {/* ── Template name ──────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={nameId}
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Template name
                  <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
                </label>
                <span
                  className={[
                    'text-xs tabular-nums',
                    nameLength > 100
                      ? 'text-red-500 font-semibold'
                      : nameLength > 80
                        ? 'text-amber-500'
                        : 'text-gray-400 dark:text-gray-500',
                  ].join(' ')}
                  aria-live="polite"
                  aria-label={`${nameLength} of 100 characters used`}
                >
                  {nameLength}/100
                </span>
              </div>

              <input
                id={nameId}
                type="text"
                value={form.name}
                onChange={handleNameChange}
                maxLength={120} // allow typing past 100 so the error is visible
                placeholder="e.g. Weekly LinkedIn Post Template"
                disabled={isSubmitting}
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${nameId}-error` : undefined}
                className={[
                  'w-full px-3.5 py-2.5 rounded-xl text-sm',
                  'bg-gray-50 dark:bg-white/5',
                  'border transition-colors duration-150',
                  'placeholder:text-gray-400 dark:placeholder:text-gray-600',
                  'text-gray-900 dark:text-white',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5] focus-visible:ring-offset-1',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  errors.name
                    ? 'border-red-400 dark:border-red-500 bg-red-50/30 dark:bg-red-900/10'
                    : 'border-gray-200 dark:border-white/10 focus:border-[#3FE0A5]/60',
                ].join(' ')}
              />

              {errors.name && (
                <p
                  id={`${nameId}-error`}
                  role="alert"
                  className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1"
                >
                  <span aria-hidden="true">⚠</span>
                  {errors.name}
                </p>
              )}
            </div>

            {/* ── Description ────────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={descId}
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Description
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1.5">
                    (optional)
                  </span>
                </label>
                <span
                  className={[
                    'text-xs tabular-nums',
                    descLength > 450
                      ? 'text-amber-500'
                      : 'text-gray-400 dark:text-gray-500',
                  ].join(' ')}
                  aria-live="polite"
                  aria-label={`${descLength} of 500 characters used`}
                >
                  {descLength}/500
                </span>
              </div>

              <textarea
                id={descId}
                value={form.description}
                onChange={handleDescriptionChange}
                rows={3}
                placeholder="Describe what this template is for…"
                disabled={isSubmitting}
                aria-describedby={`${descId}-hint`}
                className={[
                  'w-full px-3.5 py-2.5 rounded-xl text-sm resize-y',
                  'bg-gray-50 dark:bg-white/5',
                  'border border-gray-200 dark:border-white/10',
                  'placeholder:text-gray-400 dark:placeholder:text-gray-600',
                  'text-gray-900 dark:text-white',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5] focus-visible:ring-offset-1',
                  'focus:border-[#3FE0A5]/60 transition-colors duration-150',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                ].join(' ')}
              />
              <p
                id={`${descId}-hint`}
                className="text-xs text-gray-400 dark:text-gray-500"
              >
                Max 500 characters.
              </p>
            </div>

            {/* ── Config summary ──────────────────────────────────────────── */}
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 px-4 py-3 flex flex-col gap-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Current configuration
              </p>
              <div className="flex flex-wrap gap-2">
                <ConfigChip label={currentConfig.contentCategory} />
                <ConfigChip label={currentConfig.contentFormat.replace(/_/g, ' ')} />
                <ConfigChip label={currentConfig.platform} />
                <ConfigChip label={currentConfig.tone} />
              </div>
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Cancel and close modal"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSubmitting}
              disabled={isSubmitting}
              leftIcon={
                isSubmitting
                  ? <Loader2Icon size={15} className="animate-spin" aria-hidden="true" />
                  : <BookmarkIcon size={15} aria-hidden="true" />
              }
              aria-label={isSubmitting ? 'Saving template…' : 'Save template'}
            >
              {isSubmitting ? 'Saving…' : 'Save Template'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Config chip ──────────────────────────────────────────────────────────────

interface ConfigChipProps {
  label: string
}

const ConfigChip: React.FC<ConfigChipProps> = ({ label }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 capitalize">
    {label}
  </span>
)

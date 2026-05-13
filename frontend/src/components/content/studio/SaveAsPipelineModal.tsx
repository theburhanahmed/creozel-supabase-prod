import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { CalendarClockIcon, InfoIcon, Loader2Icon, WorkflowIcon, XIcon } from 'lucide-react'
import { Button } from '../../ui/Button'
import type { StudioDraftConfig } from '../../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SaveAsPipelineModalProps {
  isOpen: boolean
  currentConfig: StudioDraftConfig
  teamId: string
  onClose: () => void
  onSaved: () => void
}

// ─── Cron parser ──────────────────────────────────────────────────────────────

/**
 * Parses a cron expression (5-field standard format) and returns a
 * human-readable description, or null when the expression is invalid/empty.
 *
 * Supports the most common patterns:
 *   - Every minute:          * * * * *
 *   - Every N minutes:       *\/N * * * *
 *   - Hourly:                0 * * * *
 *   - Daily at HH:MM:        MM HH * * *
 *   - Weekly on day at time: MM HH * * D
 *   - Monthly on day:        MM HH D * *
 *   - Yearly:                MM HH D M *
 *
 * Returns null for expressions that cannot be parsed into a friendly sentence.
 */
function parseCronToHuman(expression: string): string | null {
  const trimmed = expression.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/\s+/)
  if (parts.length !== 5) return null

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Validate each field is a recognisable token (number, *, or */N)
  const isWildcard = (v: string) => v === '*'
  const isNumber = (v: string) => /^\d+$/.test(v)
  const isStep = (v: string) => /^\*\/\d+$/.test(v)
  const isValid = (v: string) => isWildcard(v) || isNumber(v) || isStep(v)

  if (!parts.every(isValid)) return null

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  // Helper: format a time string from minute + hour fields
  const formatTime = (m: string, h: string): string | null => {
    if (!isNumber(m) || !isNumber(h)) return null
    const hNum = parseInt(h, 10)
    const mNum = parseInt(m, 10)
    if (hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) return null
    const period = hNum < 12 ? 'AM' : 'PM'
    const displayHour = hNum % 12 === 0 ? 12 : hNum % 12
    const displayMin = mNum === 0 ? '' : `:${String(mNum).padStart(2, '0')}`
    return `${displayHour}${displayMin} ${period}`
  }

  // ── Every minute ──────────────────────────────────────────────────────────
  if (parts.every(isWildcard)) {
    return 'Every minute'
  }

  // ── Every N minutes: */N * * * * ─────────────────────────────────────────
  if (isStep(minute) && isWildcard(hour) && isWildcard(dayOfMonth) && isWildcard(month) && isWildcard(dayOfWeek)) {
    const n = parseInt(minute.split('/')[1], 10)
    return n === 1 ? 'Every minute' : `Every ${n} minutes`
  }

  // ── Every N hours: 0 */N * * * ───────────────────────────────────────────
  if (isNumber(minute) && isStep(hour) && isWildcard(dayOfMonth) && isWildcard(month) && isWildcard(dayOfWeek)) {
    const n = parseInt(hour.split('/')[1], 10)
    const mNum = parseInt(minute, 10)
    const minSuffix = mNum === 0 ? '' : ` at ${mNum} minutes past the hour`
    return n === 1 ? `Every hour${minSuffix}` : `Every ${n} hours${minSuffix}`
  }

  // ── Hourly: 0 * * * * ────────────────────────────────────────────────────
  if (isNumber(minute) && isWildcard(hour) && isWildcard(dayOfMonth) && isWildcard(month) && isWildcard(dayOfWeek)) {
    const mNum = parseInt(minute, 10)
    if (mNum < 0 || mNum > 59) return null
    return mNum === 0 ? 'Every hour' : `Every hour at ${mNum} minutes past`
  }

  // ── Daily: MM HH * * * ───────────────────────────────────────────────────
  if (isNumber(minute) && isNumber(hour) && isWildcard(dayOfMonth) && isWildcard(month) && isWildcard(dayOfWeek)) {
    const time = formatTime(minute, hour)
    if (!time) return null
    return `Every day at ${time}`
  }

  // ── Weekly: MM HH * * D ──────────────────────────────────────────────────
  if (isNumber(minute) && isNumber(hour) && isWildcard(dayOfMonth) && isWildcard(month) && isNumber(dayOfWeek)) {
    const time = formatTime(minute, hour)
    const dow = parseInt(dayOfWeek, 10)
    if (!time || dow < 0 || dow > 6) return null
    return `Every ${DAY_NAMES[dow]} at ${time}`
  }

  // ── Monthly: MM HH D * * ─────────────────────────────────────────────────
  if (isNumber(minute) && isNumber(hour) && isNumber(dayOfMonth) && isWildcard(month) && isWildcard(dayOfWeek)) {
    const time = formatTime(minute, hour)
    const dom = parseInt(dayOfMonth, 10)
    if (!time || dom < 1 || dom > 31) return null
    const suffix = dom === 1 ? 'st' : dom === 2 ? 'nd' : dom === 3 ? 'rd' : 'th'
    return `Monthly on the ${dom}${suffix} at ${time}`
  }

  // ── Yearly: MM HH D M * ──────────────────────────────────────────────────
  if (isNumber(minute) && isNumber(hour) && isNumber(dayOfMonth) && isNumber(month) && isWildcard(dayOfWeek)) {
    const time = formatTime(minute, hour)
    const dom = parseInt(dayOfMonth, 10)
    const mon = parseInt(month, 10)
    if (!time || dom < 1 || dom > 31 || mon < 1 || mon > 12) return null
    const suffix = dom === 1 ? 'st' : dom === 2 ? 'nd' : dom === 3 ? 'rd' : 'th'
    return `Yearly on ${MONTH_NAMES[mon - 1]} ${dom}${suffix} at ${time}`
  }

  return null
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  name: string
  description: string
  schedule: string
}

interface FormErrors {
  name?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SaveAsPipelineModal
 *
 * Collects a pipeline name (required, max 100 chars), optional description
 * (max 500 chars), and an optional cron schedule free-text input.
 *
 * The cron input updates a human-readable preview within 500 ms of the user
 * stopping typing (debounced). The actual save logic is wired in task 11.4.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.8, 12.9
 */
export const SaveAsPipelineModal: React.FC<SaveAsPipelineModalProps> = ({
  isOpen,
  currentConfig,
  teamId,
  onClose,
  onSaved,
}) => {
  // Suppress unused-variable warnings for props consumed by task 11.4
  void currentConfig
  void teamId
  void onSaved

  const nameId = useId()
  const descId = useId()
  const scheduleId = useId()

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({ name: '', description: '', schedule: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Debounced cron preview ─────────────────────────────────────────────────
  const [cronPreview, setCronPreview] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', description: '', schedule: '' })
      setErrors({})
      setIsSubmitting(false)
      setCronPreview(null)
    }
  }, [isOpen])

  // Debounce cron preview updates — must fire within 500 ms (Req 12.3)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!form.schedule.trim()) {
      setCronPreview(null)
      return
    }

    debounceRef.current = setTimeout(() => {
      setCronPreview(parseCronToHuman(form.schedule))
    }, 480) // slightly under 500 ms to ensure the requirement is met

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [form.schedule])

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
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, name: value }))
    // Clear name error as user types
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
  }, [errors.name])

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= 500) setForm((prev) => ({ ...prev, description: value }))
  }, [])

  const handleScheduleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, schedule: e.target.value }))
  }, [])

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!form.name.trim()) {
      newErrors.name = 'Pipeline name is required.'
    } else if (form.name.trim().length > 100) {
      newErrors.name = 'Pipeline name must be 100 characters or fewer.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form.name])

  // ── Submit ─────────────────────────────────────────────────────────────────
  // NOTE: The actual save logic (studioService.savePipeline) is wired in task 11.4.
  // This handler validates and sets submitting state; task 11.4 will extend it.
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return
      setIsSubmitting(true)
      // Task 11.4 will replace this placeholder with the real save call.
      // For now, we just reset submitting state so the modal remains functional.
      setIsSubmitting(false)
    },
    [validate],
  )

  // ── Render guard ───────────────────────────────────────────────────────────
  if (!isOpen) return null

  const nameLength = form.name.length
  const descLength = form.description.length
  const scheduleHasValue = form.schedule.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-pipeline-title"
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
              <WorkflowIcon size={16} className="text-[#3FE0A5]" aria-hidden="true" />
            </div>
            <h2
              id="save-pipeline-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              Save as Pipeline
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

            {/* ── Pipeline name ──────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={nameId}
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Pipeline name
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
                placeholder="e.g. Weekly LinkedIn Post"
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
                placeholder="Describe what this pipeline does…"
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

            {/* ── Cron schedule ───────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <CalendarClockIcon size={14} className="text-gray-400 dark:text-gray-500 shrink-0" aria-hidden="true" />
                <label
                  htmlFor={scheduleId}
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Schedule
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1.5">
                    (optional)
                  </span>
                </label>
              </div>

              <input
                id={scheduleId}
                type="text"
                value={form.schedule}
                onChange={handleScheduleChange}
                placeholder="e.g. 0 9 * * 1  (every Monday at 9 AM)"
                disabled={isSubmitting}
                aria-describedby={`${scheduleId}-hint ${scheduleId}-preview`}
                className={[
                  'w-full px-3.5 py-2.5 rounded-xl text-sm font-mono',
                  'bg-gray-50 dark:bg-white/5',
                  'border border-gray-200 dark:border-white/10',
                  'placeholder:text-gray-400 dark:placeholder:text-gray-600 placeholder:font-sans',
                  'text-gray-900 dark:text-white',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5] focus-visible:ring-offset-1',
                  'focus:border-[#3FE0A5]/60 transition-colors duration-150',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                ].join(' ')}
              />

              {/* Hint text */}
              <p
                id={`${scheduleId}-hint`}
                className="flex items-start gap-1 text-xs text-gray-400 dark:text-gray-500"
              >
                <InfoIcon size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
                Enter a 5-field cron expression. Leave blank to trigger manually.
              </p>

              {/* Human-readable preview — updates within 500 ms (Req 12.3) */}
              <div
                id={`${scheduleId}-preview`}
                aria-live="polite"
                aria-atomic="true"
                className="min-h-[1.5rem]"
              >
                {scheduleHasValue && (
                  cronPreview !== null ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[#3FE0A5]">
                      <CalendarClockIcon size={12} aria-hidden="true" className="shrink-0" />
                      {cronPreview}
                    </p>
                  ) : (
                    // Only show "invalid" after the debounce has fired (cronPreview is null but schedule has value)
                    form.schedule.trim().length > 0 && (
                      <p className="text-xs text-amber-500 dark:text-amber-400">
                        Invalid cron expression — check the format and try again.
                      </p>
                    )
                  )
                )}
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
                  : <WorkflowIcon size={15} aria-hidden="true" />
              }
              aria-label={isSubmitting ? 'Saving pipeline…' : 'Save pipeline'}
            >
              {isSubmitting ? 'Saving…' : 'Save Pipeline'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

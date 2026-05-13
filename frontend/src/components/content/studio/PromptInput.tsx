import React, { useId } from 'react'
import { AlertCircleIcon, AlertTriangleIcon } from 'lucide-react'

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  /** Contextual placeholder text — passed from parent based on contentCategory */
  placeholder: string
  /** Always 4000 */
  maxLength: number
  /** Inline validation message shown below the textarea */
  error?: string
}

/**
 * Multi-line prompt textarea with:
 * - Minimum 5 visible rows, user-resizable height (vertical only)
 * - Live character count in `{current}/{max}` format, updated on every keystroke
 * - Inline validation error when `error` prop is set
 * - Visible over-limit warning when `value.length > maxLength`
 *
 * The component exposes an `isOverLimit` boolean via the warning UI but does
 * NOT disable the Generate button itself — that is the parent's responsibility.
 * The parent can derive `isOverLimit` as `value.length > maxLength`.
 */
export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  placeholder,
  maxLength,
  error,
}) => {
  const textareaId = useId()
  const errorId = useId()
  const countId = useId()

  const currentLength = value.length
  const isOverLimit = currentLength > maxLength
  // Warn at 90 % of the limit so users have a heads-up before hitting the wall
  const isNearLimit = !isOverLimit && currentLength >= maxLength * 0.9

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  // Determine textarea border colour based on state priority:
  // over-limit > validation error > near-limit > default
  const borderClass = isOverLimit
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
    : error
      ? 'border-red-400 focus:border-red-400 focus:ring-red-400/30'
      : isNearLimit
        ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-400/30'
        : 'border-white/20 focus:border-[#3FE0A5] focus:ring-[#3FE0A5]/20'

  return (
    <div className="flex flex-col gap-1.5">
      {/* Textarea */}
      <textarea
        id={textareaId}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={5}
        aria-describedby={[error ? errorId : '', countId].filter(Boolean).join(' ')}
        aria-invalid={isOverLimit || !!error}
        className={[
          // Layout & sizing
          'w-full min-h-[7.5rem] resize-y rounded-xl px-4 py-3',
          // Typography
          'text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500',
          // Glass-light background (matches other studio inputs)
          'bg-white/60 dark:bg-white/5 backdrop-blur-sm',
          // Border + focus ring
          'border transition-all duration-200 outline-none',
          'focus:ring-2',
          borderClass,
          // Scrollbar styling (webkit)
          'scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/20',
        ].join(' ')}
      />

      {/* Footer row: validation / over-limit warning on the left, char count on the right */}
      <div className="flex items-start justify-between gap-2 min-h-[1.25rem]">
        {/* Left: error or over-limit warning */}
        <div className="flex-1">
          {isOverLimit ? (
            <p
              role="alert"
              className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400"
            >
              <AlertTriangleIcon size={12} aria-hidden="true" className="shrink-0" />
              Prompt exceeds {maxLength.toLocaleString()} characters. Please shorten it before
              generating.
            </p>
          ) : error ? (
            <p
              id={errorId}
              role="alert"
              className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400"
            >
              <AlertCircleIcon size={12} aria-hidden="true" className="shrink-0" />
              {error}
            </p>
          ) : null}
        </div>

        {/* Right: live character count */}
        <p
          id={countId}
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${currentLength} of ${maxLength} characters used`}
          className={[
            'shrink-0 text-xs font-medium tabular-nums transition-colors duration-150',
            isOverLimit
              ? 'text-red-500 dark:text-red-400'
              : isNearLimit
                ? 'text-amber-500 dark:text-amber-400'
                : 'text-gray-400 dark:text-gray-500',
          ].join(' ')}
        >
          {currentLength.toLocaleString()}/{maxLength.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

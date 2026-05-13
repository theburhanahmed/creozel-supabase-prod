import React, { useId } from 'react'

const MAX_LENGTH = 1000

interface RepurposingInstructionsInputProps {
  value: string
  onChange: (value: string) => void
}

/**
 * Optional textarea for supplementary repurposing instructions.
 *
 * - Max 1000 characters (Requirement 17.9)
 * - Live character count in `{current}/{max}` format, updated on every keystroke
 * - Warns visually when approaching or exceeding the limit
 */
export const RepurposingInstructionsInput: React.FC<RepurposingInstructionsInputProps> = ({
  value,
  onChange,
}) => {
  const textareaId = useId()
  const countId = useId()

  const currentLength = value.length
  const isOverLimit = currentLength > MAX_LENGTH
  // Warn at 90 % of the limit so users have a heads-up before hitting the wall
  const isNearLimit = !isOverLimit && currentLength >= MAX_LENGTH * 0.9

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  // Determine textarea border colour based on state priority:
  // over-limit > near-limit > default
  const borderClass = isOverLimit
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
    : isNearLimit
      ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-400/30'
      : 'border-white/20 focus:border-[#3FE0A5] focus:ring-[#3FE0A5]/20'

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={textareaId}
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Additional Instructions{' '}
        <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
      </label>

      {/* Textarea */}
      <textarea
        id={textareaId}
        value={value}
        onChange={handleChange}
        placeholder="Add any specific instructions for how the content should be repurposed…"
        rows={4}
        aria-describedby={countId}
        aria-invalid={isOverLimit}
        className={[
          // Layout & sizing
          'w-full min-h-[6rem] resize-y rounded-xl px-4 py-3',
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

      {/* Footer row: over-limit warning on the left, char count on the right */}
      <div className="flex items-start justify-between gap-2 min-h-[1.25rem]">
        {/* Left: over-limit warning */}
        <div className="flex-1">
          {isOverLimit && (
            <p
              role="alert"
              className="text-xs font-medium text-red-500 dark:text-red-400"
            >
              Instructions exceed {MAX_LENGTH.toLocaleString()} characters. Please shorten before
              generating.
            </p>
          )}
        </div>

        {/* Right: live character count */}
        <p
          id={countId}
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${currentLength} of ${MAX_LENGTH} characters used`}
          className={[
            'shrink-0 text-xs font-medium tabular-nums transition-colors duration-150',
            isOverLimit
              ? 'text-red-500 dark:text-red-400'
              : isNearLimit
                ? 'text-amber-500 dark:text-amber-400'
                : 'text-gray-400 dark:text-gray-500',
          ].join(' ')}
        >
          {currentLength.toLocaleString()}/{MAX_LENGTH.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

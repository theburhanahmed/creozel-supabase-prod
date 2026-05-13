import React from 'react'
import {
  TypeIcon,
  SquareIcon,
  ClockIcon,
  FileIcon,
  InfoIcon,
} from 'lucide-react'
import type { ContentFormat, StudioPlatform, PlatformConstraints } from '../../../types'

export interface PlatformConstraintHintProps {
  format: ContentFormat
  platform: StudioPlatform
  constraints: PlatformConstraints | null
}

interface HintItem {
  icon: React.ReactNode
  label: string
  value: string
  ariaLabel: string
}

/**
 * Builds the list of hint items from a non-null PlatformConstraints object.
 * Only includes fields that have a meaningful value (non-null / non-empty).
 */
function buildHints(constraints: PlatformConstraints): HintItem[] {
  const hints: HintItem[] = []

  if (constraints.characterLimit !== null) {
    hints.push({
      icon: <TypeIcon size={12} aria-hidden="true" />,
      label: 'Char limit',
      value: constraints.characterLimit.toLocaleString(),
      ariaLabel: `Character limit: ${constraints.characterLimit.toLocaleString()}`,
    })
  }

  if (constraints.aspectRatio !== null) {
    hints.push({
      icon: <SquareIcon size={12} aria-hidden="true" />,
      label: 'Aspect ratio',
      value: constraints.aspectRatio,
      ariaLabel: `Aspect ratio: ${constraints.aspectRatio}`,
    })
  }

  if (constraints.durationLimitSeconds !== null) {
    const seconds = constraints.durationLimitSeconds
    const display = seconds >= 60
      ? `${Math.floor(seconds / 60)}m ${seconds % 60 > 0 ? `${seconds % 60}s` : ''}`.trim()
      : `${seconds}s`
    hints.push({
      icon: <ClockIcon size={12} aria-hidden="true" />,
      label: 'Max duration',
      value: display,
      ariaLabel: `Maximum duration: ${display}`,
    })
  }

  if (constraints.fileSizeLimitMb !== null) {
    const mb = constraints.fileSizeLimitMb
    const display = mb >= 1000 ? `${(mb / 1000).toFixed(0)} GB` : `${mb} MB`
    hints.push({
      icon: <FileIcon size={12} aria-hidden="true" />,
      label: 'Max file size',
      value: display,
      ariaLabel: `Maximum file size: ${display}`,
    })
  }

  if (constraints.acceptedFileFormats.length > 0) {
    const formatsDisplay = constraints.acceptedFileFormats.join(', ')
    hints.push({
      icon: <FileIcon size={12} aria-hidden="true" />,
      label: 'Formats',
      value: formatsDisplay,
      ariaLabel: `Accepted file formats: ${formatsDisplay}`,
    })
  }

  return hints
}

/**
 * Displays platform-specific constraints as inline hint chips adjacent to the
 * platform selector.
 *
 * - When `constraints` is non-null, renders individual hint chips for each
 *   defined constraint field (character limit, aspect ratio, duration limit,
 *   file size limit, accepted file formats).
 * - When `constraints` is null, renders a single muted notice reading
 *   "No specific constraints for this combination".
 *
 * The component is purely presentational — it receives the already-resolved
 * `constraints` value from the parent (which calls `usePlatformConstraints`).
 */
export const PlatformConstraintHint: React.FC<PlatformConstraintHintProps> = ({
  format: _format,
  platform: _platform,
  constraints,
}) => {
  // No constraints defined for this format + platform combination
  if (constraints === null) {
    return (
      <p
        className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 italic"
        aria-live="polite"
      >
        <InfoIcon size={12} aria-hidden="true" className="shrink-0" />
        No specific constraints for this combination
      </p>
    )
  }

  const hints = buildHints(constraints)

  // All fields are null / empty — treat the same as no constraints
  if (hints.length === 0) {
    return (
      <p
        className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 italic"
        aria-live="polite"
      >
        <InfoIcon size={12} aria-hidden="true" className="shrink-0" />
        No specific constraints for this combination
      </p>
    )
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="list"
      aria-label="Platform constraints"
      aria-live="polite"
    >
      {hints.map((hint) => (
        <span
          key={hint.label}
          role="listitem"
          aria-label={hint.ariaLabel}
          className={[
            'inline-flex items-center gap-1 px-2 py-1 rounded-md',
            'text-xs font-medium',
            'glass-light border border-gray-200/60 dark:border-white/10',
            'text-gray-600 dark:text-gray-300',
          ].join(' ')}
        >
          <span className="text-[#3FE0A5] shrink-0">{hint.icon}</span>
          <span className="text-gray-400 dark:text-gray-500">{hint.label}:</span>
          <span>{hint.value}</span>
        </span>
      ))}
    </div>
  )
}

import React, { useId } from 'react'
import { AlertCircleIcon } from 'lucide-react'
import type { ContentCategory, LengthConfig, LengthPreset } from '../../../types'

export interface LengthSelectorProps {
  category: ContentCategory
  value: LengthConfig
  onChange: (value: LengthConfig) => void
  error?: string
}

// ─── Default configs per Requirement 6.7 ─────────────────────────────────────

/** Returns the default LengthConfig for a given category (Requirement 6.7). */
export function getDefaultLengthConfig(category: ContentCategory): LengthConfig {
  switch (category) {
    case 'text':
    case 'story':
      return {
        preset: 'medium',
        minWords: 150,
        maxWords: 500,
        durationSeconds: null,
        quantity: null,
        speakingRate: null,
      }
    case 'video':
      return {
        preset: 'medium',
        minWords: null,
        maxWords: null,
        durationSeconds: null,
        quantity: null,
        speakingRate: null,
      }
    case 'image':
      return {
        preset: null,
        minWords: null,
        maxWords: null,
        durationSeconds: null,
        quantity: 1,
        speakingRate: null,
      }
    case 'audio':
      return {
        preset: null,
        minWords: null,
        maxWords: null,
        durationSeconds: null,
        quantity: null,
        speakingRate: 1.0,
      }
  }
}

// ─── Text / Story preset definitions ─────────────────────────────────────────

interface TextPresetConfig {
  value: LengthPreset
  label: string
  description: string
  minWords: number | null
  maxWords: number | null
}

const TEXT_PRESETS: TextPresetConfig[] = [
  {
    value: 'short',
    label: 'Short',
    description: 'Up to 150 words',
    minWords: 1,
    maxWords: 150,
  },
  {
    value: 'medium',
    label: 'Medium',
    description: '150–500 words',
    minWords: 150,
    maxWords: 500,
  },
  {
    value: 'long',
    label: 'Long',
    description: '500–1,500 words',
    minWords: 500,
    maxWords: 1500,
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Set your own range',
    minWords: null,
    maxWords: null,
  },
]

// ─── Video preset definitions ─────────────────────────────────────────────────

interface VideoPresetConfig {
  value: LengthPreset
  label: string
  description: string
}

const VIDEO_PRESETS: VideoPresetConfig[] = [
  { value: 'short', label: 'Short', description: '1–3 scenes' },
  { value: 'medium', label: 'Medium', description: '4–6 scenes' },
  { value: 'long', label: 'Long', description: '7–10 scenes' },
]

// ─── Image resolution options ─────────────────────────────────────────────────

const IMAGE_RESOLUTIONS = [
  { value: '512x512', label: '512 × 512' },
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '1792x1024', label: '1792 × 1024' },
  { value: '1024x1792', label: '1024 × 1792' },
] as const

type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number]['value']

// ─── Shared preset button ─────────────────────────────────────────────────────

interface PresetButtonProps {
  isActive: boolean
  label: string
  description: string
  onClick: () => void
  'aria-label'?: string
}

const PresetButton: React.FC<PresetButtonProps> = ({
  isActive,
  label,
  description,
  onClick,
  'aria-label': ariaLabel,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={isActive}
    aria-label={ariaLabel ?? `${label}${isActive ? ', selected' : ''}`}
    onClick={onClick}
    className={[
      'flex flex-col items-start px-3 py-2 rounded-lg border text-left',
      'transition-all duration-200 select-none outline-none',
      'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3FE0A5]',
      isActive
        ? 'border-[#3FE0A5] bg-[#3FE0A5]/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-[#3FE0A5]/30 shadow-sm'
        : 'border-transparent glass-light text-gray-600 dark:text-gray-400 hover:border-gray-200 dark:hover:border-white/20 hover:text-gray-800 dark:hover:text-gray-200',
    ].join(' ')}
  >
    <span className="text-sm font-medium leading-tight">{label}</span>
    <span className="text-xs opacity-70 mt-0.5">{description}</span>
  </button>
)

// ─── Text / Story controls ────────────────────────────────────────────────────

interface TextLengthControlsProps {
  value: LengthConfig
  onChange: (value: LengthConfig) => void
  error?: string
}

const TextLengthControls: React.FC<TextLengthControlsProps> = ({
  value,
  onChange,
  error,
}) => {
  const minId = useId()
  const maxId = useId()
  const errorId = useId()

  const activePreset = value.preset ?? 'medium'
  const isCustom = activePreset === 'custom'

  const handlePresetClick = (preset: TextPresetConfig) => {
    onChange({
      ...value,
      preset: preset.value,
      minWords: preset.minWords,
      maxWords: preset.maxWords,
    })
  }

  const handleMinWords = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = raw === '' ? null : Math.max(1, Math.min(10000, parseInt(raw, 10)))
    onChange({ ...value, minWords: isNaN(parsed as number) ? null : parsed })
  }

  const handleMaxWords = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = raw === '' ? null : Math.max(1, Math.min(10000, parseInt(raw, 10)))
    onChange({ ...value, maxWords: isNaN(parsed as number) ? null : parsed })
  }

  // Inline validation: maxWords < minWords (Requirement 6.2)
  const hasRangeError =
    isCustom &&
    value.minWords !== null &&
    value.maxWords !== null &&
    value.maxWords < value.minWords

  const displayError = error ?? (hasRangeError ? 'Maximum must be greater than or equal to minimum.' : undefined)

  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div
        role="radiogroup"
        aria-label="Text length preset"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {TEXT_PRESETS.map((preset) => (
          <PresetButton
            key={preset.value}
            isActive={activePreset === preset.value}
            label={preset.label}
            description={preset.description}
            onClick={() => handlePresetClick(preset)}
          />
        ))}
      </div>

      {/* Custom word count inputs */}
      {isCustom && (
        <div className="flex flex-wrap items-start gap-3 pt-1">
          {/* Min words */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor={minId}
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              Min words
            </label>
            <input
              id={minId}
              type="number"
              min={1}
              max={10000}
              step={1}
              value={value.minWords ?? ''}
              onChange={handleMinWords}
              aria-describedby={displayError ? errorId : undefined}
              aria-invalid={hasRangeError}
              placeholder="e.g. 100"
              className={[
                'w-28 rounded-lg border px-3 py-1.5 text-sm',
                'bg-white/60 dark:bg-white/5 backdrop-blur-sm',
                'text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'outline-none transition-all duration-200',
                'focus:ring-2',
                hasRangeError
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400/30'
                  : 'border-white/20 focus:border-[#3FE0A5] focus:ring-[#3FE0A5]/20',
              ].join(' ')}
            />
          </div>

          {/* Separator */}
          <span className="self-end pb-2 text-sm text-gray-400 dark:text-gray-500">–</span>

          {/* Max words */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor={maxId}
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              Max words
            </label>
            <input
              id={maxId}
              type="number"
              min={1}
              max={10000}
              step={1}
              value={value.maxWords ?? ''}
              onChange={handleMaxWords}
              aria-describedby={displayError ? errorId : undefined}
              aria-invalid={hasRangeError}
              placeholder="e.g. 500"
              className={[
                'w-28 rounded-lg border px-3 py-1.5 text-sm',
                'bg-white/60 dark:bg-white/5 backdrop-blur-sm',
                'text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'outline-none transition-all duration-200',
                'focus:ring-2',
                hasRangeError
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400/30'
                  : 'border-white/20 focus:border-[#3FE0A5] focus:ring-[#3FE0A5]/20',
              ].join(' ')}
            />
          </div>
        </div>
      )}

      {/* Inline validation error */}
      {displayError && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400"
        >
          <AlertCircleIcon size={12} aria-hidden="true" className="shrink-0" />
          {displayError}
        </p>
      )}
    </div>
  )
}

// ─── Video controls ───────────────────────────────────────────────────────────

interface VideoLengthControlsProps {
  value: LengthConfig
  onChange: (value: LengthConfig) => void
}

const VideoLengthControls: React.FC<VideoLengthControlsProps> = ({ value, onChange }) => {
  const activePreset = value.preset ?? 'medium'

  return (
    <div
      role="radiogroup"
      aria-label="Video length preset"
      className="grid grid-cols-3 gap-2"
    >
      {VIDEO_PRESETS.map((preset) => (
        <PresetButton
          key={preset.value}
          isActive={activePreset === preset.value}
          label={preset.label}
          description={preset.description}
          onClick={() => onChange({ ...value, preset: preset.value })}
        />
      ))}
    </div>
  )
}

// ─── Image controls ───────────────────────────────────────────────────────────

interface ImageLengthControlsProps {
  value: LengthConfig
  onChange: (value: LengthConfig) => void
}

const ImageLengthControls: React.FC<ImageLengthControlsProps> = ({ value, onChange }) => {
  const quantityId = useId()
  const resolutionId = useId()

  const quantity = value.quantity ?? 1
  // Derive resolution from the value object — stored in a custom field via
  // the `durationSeconds` field repurposed as a resolution index, but the
  // design stores resolution as a string. We use a local helper: the
  // resolution is carried in the `maxWords` field as a numeric index into
  // IMAGE_RESOLUTIONS when category is image, OR we can store it separately.
  // Per the LengthConfig interface there is no dedicated resolution field, so
  // we encode the resolution index in `durationSeconds` (null → default 1024x1024).
  const resolutionIndex = value.durationSeconds !== null ? value.durationSeconds : 1
  const currentResolution: ImageResolution =
    IMAGE_RESOLUTIONS[resolutionIndex]?.value ?? '1024x1024'

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 1))
    onChange({ ...value, quantity: q })
  }

  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = IMAGE_RESOLUTIONS.findIndex((r) => r.value === e.target.value)
    onChange({ ...value, durationSeconds: idx >= 0 ? idx : 1 })
  }

  return (
    <div className="flex flex-wrap gap-4">
      {/* Quantity */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={quantityId}
          className="text-xs font-medium text-gray-500 dark:text-gray-400"
        >
          Quantity
        </label>
        <input
          id={quantityId}
          type="number"
          min={1}
          max={4}
          step={1}
          value={quantity}
          onChange={handleQuantityChange}
          aria-label="Number of images to generate (1–4)"
          className={[
            'w-20 rounded-lg border border-white/20 px-3 py-1.5 text-sm',
            'bg-white/60 dark:bg-white/5 backdrop-blur-sm',
            'text-gray-800 dark:text-gray-100',
            'outline-none transition-all duration-200',
            'focus:ring-2 focus:border-[#3FE0A5] focus:ring-[#3FE0A5]/20',
          ].join(' ')}
        />
      </div>

      {/* Resolution */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={resolutionId}
          className="text-xs font-medium text-gray-500 dark:text-gray-400"
        >
          Resolution
        </label>
        <select
          id={resolutionId}
          value={currentResolution}
          onChange={handleResolutionChange}
          aria-label="Image resolution"
          className={[
            'rounded-lg border border-white/20 px-3 py-1.5 text-sm',
            'bg-white/60 dark:bg-white/5 backdrop-blur-sm',
            'text-gray-800 dark:text-gray-100',
            'outline-none transition-all duration-200',
            'focus:ring-2 focus:border-[#3FE0A5] focus:ring-[#3FE0A5]/20',
            'cursor-pointer',
          ].join(' ')}
        >
          {IMAGE_RESOLUTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─── Audio controls ───────────────────────────────────────────────────────────

interface AudioLengthControlsProps {
  value: LengthConfig
  onChange: (value: LengthConfig) => void
}

const SPEAKING_RATE_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const
const SPEAKING_RATE_MIN = 0.5
const SPEAKING_RATE_MAX = 2.0
const SPEAKING_RATE_STEP = 0.25

const AudioLengthControls: React.FC<AudioLengthControlsProps> = ({ value, onChange }) => {
  const sliderId = useId()

  const speakingRate = value.speakingRate ?? 1.0

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value)
    onChange({ ...value, speakingRate: rate })
  }

  // Map rate to a percentage for the filled-track visual
  const fillPercent =
    ((speakingRate - SPEAKING_RATE_MIN) / (SPEAKING_RATE_MAX - SPEAKING_RATE_MIN)) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor={sliderId}
          className="text-xs font-medium text-gray-500 dark:text-gray-400"
        >
          Speaking rate
        </label>
        <span
          aria-live="polite"
          aria-atomic="true"
          className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums"
        >
          {speakingRate.toFixed(2)}×
        </span>
      </div>

      {/* Slider */}
      <div className="relative flex items-center">
        <input
          id={sliderId}
          type="range"
          min={SPEAKING_RATE_MIN}
          max={SPEAKING_RATE_MAX}
          step={SPEAKING_RATE_STEP}
          value={speakingRate}
          onChange={handleSliderChange}
          aria-label={`Speaking rate: ${speakingRate.toFixed(2)}× (0.5× to 2.0×, step 0.25×)`}
          aria-valuemin={SPEAKING_RATE_MIN}
          aria-valuemax={SPEAKING_RATE_MAX}
          aria-valuenow={speakingRate}
          aria-valuetext={`${speakingRate.toFixed(2)} times`}
          style={
            {
              '--fill-percent': `${fillPercent}%`,
            } as React.CSSProperties
          }
          className={[
            'w-full h-2 rounded-full appearance-none cursor-pointer outline-none',
            'bg-gray-200 dark:bg-white/10',
            // Filled portion via a CSS custom property on the track
            '[&::-webkit-slider-runnable-track]:rounded-full',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-[#3FE0A5]',
            '[&::-webkit-slider-thumb]:shadow-sm',
            '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-[#3FE0A5]',
            '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white',
            '[&::-moz-range-thumb]:cursor-pointer',
            'focus-visible:ring-2 focus-visible:ring-[#3FE0A5] focus-visible:ring-offset-1',
          ].join(' ')}
        />
      </div>

      {/* Tick labels */}
      <div className="flex justify-between px-0.5">
        {SPEAKING_RATE_STEPS.map((rate) => (
          <button
            key={rate}
            type="button"
            aria-label={`Set speaking rate to ${rate}×`}
            onClick={() => onChange({ ...value, speakingRate: rate })}
            className={[
              'text-xs tabular-nums transition-colors duration-150',
              speakingRate === rate
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
            ].join(' ')}
          >
            {rate}×
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── LengthSelector (main export) ────────────────────────────────────────────

/**
 * Per-category length / output-size selector (Requirement 6).
 *
 * - **text / story**: Short / Medium / Long / Custom presets. When Custom is
 *   selected, min/max word count inputs (integer, 1–10,000) are revealed.
 *   An inline validation error is shown when maxWords < minWords (Req 6.2).
 * - **video**: Short (1–3 scenes) / Medium (4–6 scenes) / Long (7–10 scenes).
 * - **image**: Quantity selector (1–4) and resolution selector
 *   (512×512, 1024×1024, 1792×1024, 1024×1792).
 * - **audio**: Speaking rate slider (0.5×–2.0×, step 0.25×).
 *
 * Defaults per Requirement 6.7:
 * - text/story → Medium preset
 * - video → Medium preset
 * - image → quantity 1, resolution 1024×1024
 * - audio → speaking rate 1.0×
 *
 * The component is purely presentational — the parent owns state via
 * `useStudioState` and passes `value` / `onChange` down.
 */
export const LengthSelector: React.FC<LengthSelectorProps> = ({
  category,
  value,
  onChange,
  error,
}) => {
  return (
    <div className="space-y-2">
      {(category === 'text' || category === 'story') && (
        <TextLengthControls value={value} onChange={onChange} error={error} />
      )}

      {category === 'video' && (
        <VideoLengthControls value={value} onChange={onChange} />
      )}

      {category === 'image' && (
        <ImageLengthControls value={value} onChange={onChange} />
      )}

      {category === 'audio' && (
        <AudioLengthControls value={value} onChange={onChange} />
      )}

      {/* External error (e.g. from form validation) for non-text categories */}
      {error && category !== 'text' && category !== 'story' && (
        <p
          role="alert"
          className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400"
        >
          <AlertCircleIcon size={12} aria-hidden="true" className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

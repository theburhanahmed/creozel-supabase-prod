import React, { useId, useState } from 'react'
import { ChevronDownIcon, RefreshCwIcon, Loader2Icon, AlertCircleIcon } from 'lucide-react'
import type {
  ContentCategory,
  TextAdvancedOptions,
  ImageAdvancedOptions,
  VideoAdvancedOptions,
  AudioAdvancedOptions,
  VoiceOption,
} from '../../../types'

// ─── Shared field styles (matching ContentHub pattern) ────────────────────────

const labelClass =
  'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

const fieldClass = [
  'w-full rounded-lg border border-white/20 px-3 py-1.5 text-sm',
  'bg-white/60 dark:bg-white/5 backdrop-blur-sm',
  'text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500',
  'outline-none transition-all duration-200',
  'focus:ring-2 focus:border-[#3FE0A5] focus:ring-[#3FE0A5]/20',
].join(' ')

const checkboxClass =
  'h-4 w-4 rounded border-gray-300 text-[#3FE0A5] focus:ring-[#3FE0A5] focus:ring-offset-0'

// ─── Props interface ──────────────────────────────────────────────────────────

export interface AdvancedOptionsPanelProps {
  category: ContentCategory
  textOptions: TextAdvancedOptions
  imageOptions: ImageAdvancedOptions
  videoOptions: VideoAdvancedOptions
  audioOptions: AudioAdvancedOptions
  onTextChange: (opts: TextAdvancedOptions) => void
  onImageChange: (opts: ImageAdvancedOptions) => void
  onVideoChange: (opts: VideoAdvancedOptions) => void
  onAudioChange: (opts: AudioAdvancedOptions) => void
  voices: VoiceOption[]
  voicesLoading: boolean
  voicesFailed: boolean
  onRetryVoices: () => void
}

// ─── TextAdvancedOptions sub-panel ───────────────────────────────────────────

interface TextAdvancedOptionsProps {
  options: TextAdvancedOptions
  onChange: (opts: TextAdvancedOptions) => void
}

const TextAdvancedOptionsPanel: React.FC<TextAdvancedOptionsProps> = ({
  options,
  onChange,
}) => {
  const languageId = useId()

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* AI Model */}
      <div>
        <label className={labelClass}>AI Model</label>
        <select
          value={options.model}
          onChange={(e) =>
            onChange({ ...options, model: e.target.value as TextAdvancedOptions['model'] })
          }
          aria-label="AI model"
          className={fieldClass}
        >
          <option value="gpt-4">GPT-4</option>
          <option value="gpt-3.5">GPT-3.5</option>
        </select>
      </div>

      {/* Output Format */}
      <div>
        <label className={labelClass}>Output Format</label>
        <select
          value={options.outputFormat}
          onChange={(e) =>
            onChange({
              ...options,
              outputFormat: e.target.value as TextAdvancedOptions['outputFormat'],
            })
          }
          aria-label="Output format"
          className={fieldClass}
        >
          <option value="blog_post">Blog Post</option>
          <option value="caption">Caption</option>
          <option value="ad_copy">Ad Copy</option>
          <option value="thread">Thread</option>
          <option value="email">Email</option>
        </select>
      </div>

      {/* Language */}
      <div>
        <label htmlFor={languageId} className={labelClass}>
          Language
        </label>
        <input
          id={languageId}
          type="text"
          value={options.language}
          maxLength={50}
          onChange={(e) =>
            onChange({ ...options, language: e.target.value.slice(0, 50) })
          }
          placeholder="e.g. English"
          aria-label="Language (free text, max 50 characters)"
          className={fieldClass}
        />
      </div>

      {/* Brand Voice Toggle */}
      <div className="flex items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.brandVoiceEnabled}
            onChange={(e) =>
              onChange({ ...options, brandVoiceEnabled: e.target.checked })
            }
            className={checkboxClass}
            aria-label="Use brand voice guidelines"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Brand voice
          </span>
        </label>
      </div>
    </div>
  )
}

// ─── ImageAdvancedOptions sub-panel ──────────────────────────────────────────

interface ImageAdvancedOptionsProps {
  options: ImageAdvancedOptions
  onChange: (opts: ImageAdvancedOptions) => void
}

const ImageAdvancedOptionsPanel: React.FC<ImageAdvancedOptionsProps> = ({
  options,
  onChange,
}) => {
  const negativePromptId = useId()
  const seedId = useId()

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* AI Provider */}
      <div>
        <label className={labelClass}>AI Provider</label>
        <select
          value={options.provider}
          onChange={(e) =>
            onChange({
              ...options,
              provider: e.target.value as ImageAdvancedOptions['provider'],
            })
          }
          aria-label="AI provider"
          className={fieldClass}
        >
          <option value="dall-e-3">DALL-E 3</option>
          <option value="stable-diffusion">Stable Diffusion</option>
        </select>
      </div>

      {/* Style */}
      <div>
        <label className={labelClass}>Style</label>
        <select
          value={options.style}
          onChange={(e) =>
            onChange({
              ...options,
              style: e.target.value as ImageAdvancedOptions['style'],
            })
          }
          aria-label="Image style"
          className={fieldClass}
        >
          <option value="photorealistic">Photorealistic</option>
          <option value="illustration">Illustration</option>
          <option value="digital_art">Digital Art</option>
          <option value="oil_painting">Oil Painting</option>
          <option value="watercolor">Watercolor</option>
        </select>
      </div>

      {/* Negative Prompt */}
      <div className="col-span-2">
        <label htmlFor={negativePromptId} className={labelClass}>
          Negative Prompt
        </label>
        <textarea
          id={negativePromptId}
          value={options.negativePrompt}
          maxLength={500}
          rows={2}
          onChange={(e) =>
            onChange({ ...options, negativePrompt: e.target.value.slice(0, 500) })
          }
          placeholder="Things to avoid in the image…"
          aria-label="Negative prompt (max 500 characters)"
          className={`${fieldClass} resize-none`}
        />
        <p className="text-xs text-gray-400 text-right mt-0.5">
          {options.negativePrompt.length}/500
        </p>
      </div>

      {/* Seed */}
      <div>
        <label htmlFor={seedId} className={labelClass}>
          Seed
        </label>
        <input
          id={seedId}
          type="number"
          min={0}
          max={2147483647}
          step={1}
          value={options.seed}
          onChange={(e) => {
            const val = Math.max(0, Math.min(2147483647, parseInt(e.target.value, 10) || 0))
            onChange({ ...options, seed: val })
          }}
          placeholder="0–2,147,483,647"
          aria-label="Seed integer (0 to 2,147,483,647)"
          className={fieldClass}
        />
      </div>
    </div>
  )
}

// ─── VideoAdvancedOptions sub-panel ──────────────────────────────────────────

interface VideoAdvancedOptionsProps {
  options: VideoAdvancedOptions
  onChange: (opts: VideoAdvancedOptions) => void
}

const VideoAdvancedOptionsPanel: React.FC<VideoAdvancedOptionsProps> = ({
  options,
  onChange,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* AI Model */}
      <div>
        <label className={labelClass}>AI Model</label>
        <select
          value={options.model}
          onChange={(e) =>
            onChange({
              ...options,
              model: e.target.value as VideoAdvancedOptions['model'],
            })
          }
          aria-label="AI model"
          className={fieldClass}
        >
          <option value="gpt-4">GPT-4</option>
          <option value="gpt-3.5">GPT-3.5</option>
        </select>
      </div>

      {/* Aspect Ratio */}
      <div>
        <label className={labelClass}>Aspect Ratio</label>
        <select
          value={options.aspectRatio}
          onChange={(e) =>
            onChange({
              ...options,
              aspectRatio: e.target.value as VideoAdvancedOptions['aspectRatio'],
            })
          }
          aria-label="Aspect ratio"
          className={fieldClass}
        >
          <option value="16:9">16:9 (Landscape)</option>
          <option value="9:16">9:16 (Portrait)</option>
          <option value="1:1">1:1 (Square)</option>
        </select>
      </div>

      {/* Include B-Roll Toggle */}
      <div className="flex items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.includeBRoll}
            onChange={(e) =>
              onChange({ ...options, includeBRoll: e.target.checked })
            }
            className={checkboxClass}
            aria-label="Include B-roll suggestions"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Include B-roll suggestions
          </span>
        </label>
      </div>

      {/* Brand Voice Toggle */}
      <div className="flex items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.brandVoiceEnabled}
            onChange={(e) =>
              onChange({ ...options, brandVoiceEnabled: e.target.checked })
            }
            className={checkboxClass}
            aria-label="Use brand voice guidelines"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Brand voice
          </span>
        </label>
      </div>
    </div>
  )
}

// ─── AudioAdvancedOptions sub-panel ──────────────────────────────────────────

interface AudioAdvancedOptionsPanelProps {
  options: AudioAdvancedOptions
  onChange: (opts: AudioAdvancedOptions) => void
  voices: VoiceOption[]
  voicesLoading: boolean
  voicesFailed: boolean
  onRetryVoices: () => void
}

const AudioAdvancedOptionsPanel: React.FC<AudioAdvancedOptionsPanelProps> = ({
  options,
  onChange,
  voices,
  voicesLoading,
  voicesFailed,
  onRetryVoices,
}) => {
  const pitchId = useId()
  const stabilityId = useId()

  const pitchFillPercent = ((options.pitchAdjustment - -10) / (10 - -10)) * 100
  const stabilityFillPercent = (options.stabilityClarity / 100) * 100

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* TTS Provider */}
      <div>
        <label className={labelClass}>TTS Provider</label>
        <select
          value={options.provider}
          onChange={(e) =>
            onChange({
              ...options,
              provider: e.target.value as AudioAdvancedOptions['provider'],
            })
          }
          aria-label="TTS provider"
          className={fieldClass}
        >
          <option value="elevenlabs">ElevenLabs</option>
          <option value="whisper">Whisper</option>
        </select>
      </div>

      {/* Voice Selector */}
      <div>
        <label className={labelClass}>Voice</label>
        {voicesLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
            <Loader2Icon size={12} className="animate-spin" aria-hidden="true" />
            Loading voices…
          </div>
        ) : voicesFailed ? (
          /* Req 7.6 — failed state: message + retry button, selector disabled */
          <div className="space-y-1.5">
            <select
              value=""
              disabled
              aria-label="Voice selector — unavailable"
              aria-disabled="true"
              className={`${fieldClass} opacity-50 cursor-not-allowed`}
            >
              <option value="">Failed to load voices</option>
            </select>
            <div className="flex items-center gap-1.5">
              <AlertCircleIcon
                size={12}
                className="shrink-0 text-red-500"
                aria-hidden="true"
              />
              <span className="text-xs text-red-500">Failed to load voices</span>
              <button
                type="button"
                onClick={onRetryVoices}
                className="flex items-center gap-1 text-xs text-[#3FE0A5] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5] rounded"
                aria-label="Retry loading voices"
              >
                <RefreshCwIcon size={12} aria-hidden="true" />
                Retry
              </button>
            </div>
          </div>
        ) : (
          <select
            value={options.voiceId}
            onChange={(e) => onChange({ ...options, voiceId: e.target.value })}
            disabled={voices.length === 0}
            aria-label="Voice"
            className={`${fieldClass} ${voices.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {voices.length === 0 ? (
              <option value="">No voices available</option>
            ) : (
              voices.map((v) => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}
                </option>
              ))
            )}
          </select>
        )}
      </div>

      {/* Pitch Adjustment slider — col-span-2 */}
      <div className="col-span-2 space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor={pitchId}
            className="text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            Pitch Adjustment
          </label>
          <span
            aria-live="polite"
            aria-atomic="true"
            className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums"
          >
            {options.pitchAdjustment > 0 ? '+' : ''}
            {options.pitchAdjustment} st
          </span>
        </div>
        <input
          id={pitchId}
          type="range"
          min={-10}
          max={10}
          step={1}
          value={options.pitchAdjustment}
          onChange={(e) =>
            onChange({ ...options, pitchAdjustment: Number(e.target.value) })
          }
          aria-label={`Pitch adjustment: ${options.pitchAdjustment > 0 ? '+' : ''}${options.pitchAdjustment} semitones (−10 to +10)`}
          aria-valuemin={-10}
          aria-valuemax={10}
          aria-valuenow={options.pitchAdjustment}
          style={{ '--fill-percent': `${pitchFillPercent}%` } as React.CSSProperties}
          className={[
            'w-full h-2 rounded-full appearance-none cursor-pointer outline-none',
            'bg-gray-200 dark:bg-white/10',
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
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 px-0.5">
          <span>−10</span>
          <span>0</span>
          <span>+10</span>
        </div>
      </div>

      {/* Stability / Clarity — ElevenLabs only (Req 7.5) */}
      {options.provider === 'elevenlabs' && (
        <div className="col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor={stabilityId}
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              Stability / Clarity
            </label>
            <span
              aria-live="polite"
              aria-atomic="true"
              className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums"
            >
              {options.stabilityClarity}
            </span>
          </div>
          <input
            id={stabilityId}
            type="range"
            min={0}
            max={100}
            step={1}
            value={options.stabilityClarity}
            onChange={(e) =>
              onChange({ ...options, stabilityClarity: Number(e.target.value) })
            }
            aria-label={`Stability / Clarity: ${options.stabilityClarity} (0 to 100)`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={options.stabilityClarity}
            style={{ '--fill-percent': `${stabilityFillPercent}%` } as React.CSSProperties}
            className={[
              'w-full h-2 rounded-full appearance-none cursor-pointer outline-none',
              'bg-gray-200 dark:bg-white/10',
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
          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 px-0.5">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      )}

      {/* Output Format */}
      <div>
        <label className={labelClass}>Output Format</label>
        <select
          value={options.outputFormat}
          onChange={(e) =>
            onChange({
              ...options,
              outputFormat: e.target.value as AudioAdvancedOptions['outputFormat'],
            })
          }
          aria-label="Output format"
          className={fieldClass}
        >
          <option value="mp3">MP3</option>
          <option value="wav">WAV</option>
        </select>
      </div>
    </div>
  )
}

// ─── AdvancedOptionsPanel (main export) ──────────────────────────────────────

/**
 * Collapsible Advanced Options panel (Requirement 7).
 *
 * - Defaults to **collapsed** (Req 7.1).
 * - Renders the appropriate sub-panel based on `category` prop:
 *   - `text`  → TextAdvancedOptions  (Req 7.2)
 *   - `image` → ImageAdvancedOptions (Req 7.3)
 *   - `video` → VideoAdvancedOptions (Req 7.4)
 *   - `audio` → AudioAdvancedOptions (Req 7.5)
 *   - `story` → TextAdvancedOptions  (story shares text options)
 * - AudioAdvancedOptions shows "Failed to load voices" + retry when
 *   `voicesFailed` is true (Req 7.6).
 * - All sub-panels are purely presentational — no internal state for options.
 *   The parent owns state via `useStudioState` (Req 7.7).
 */
export const AdvancedOptionsPanel: React.FC<AdvancedOptionsPanelProps> = ({
  category,
  textOptions,
  imageOptions,
  videoOptions,
  audioOptions,
  onTextChange,
  onImageChange,
  onVideoChange,
  onAudioChange,
  voices,
  voicesLoading,
  voicesFailed,
  onRetryVoices,
}) => {
  // Collapsible state — defaults to collapsed (Req 7.1)
  const [isOpen, setIsOpen] = useState(false)

  // story category shares the text advanced options panel
  const showText = category === 'text' || category === 'story'
  const showImage = category === 'image'
  const showVideo = category === 'video'
  const showAudio = category === 'audio'

  return (
    <div className="border border-gray-200/50 dark:border-gray-700/30 rounded-xl overflow-hidden">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="advanced-options-content"
        className={[
          'w-full flex items-center justify-between px-4 py-3',
          'text-sm font-medium text-gray-600 dark:text-gray-400',
          'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3FE0A5]',
        ].join(' ')}
      >
        <span>Advanced options</span>
        <ChevronDownIcon
          size={16}
          aria-hidden="true"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div
          id="advanced-options-content"
          className="px-4 pb-4 border-t border-gray-200/50 dark:border-gray-700/30 pt-4"
        >
          {showText && (
            <TextAdvancedOptionsPanel options={textOptions} onChange={onTextChange} />
          )}

          {showImage && (
            <ImageAdvancedOptionsPanel options={imageOptions} onChange={onImageChange} />
          )}

          {showVideo && (
            <VideoAdvancedOptionsPanel options={videoOptions} onChange={onVideoChange} />
          )}

          {showAudio && (
            <AudioAdvancedOptionsPanel
              options={audioOptions}
              onChange={onAudioChange}
              voices={voices}
              voicesLoading={voicesLoading}
              voicesFailed={voicesFailed}
              onRetryVoices={onRetryVoices}
            />
          )}
        </div>
      )}
    </div>
  )
}

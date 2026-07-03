import React, { useMemo } from 'react'
import { CONTENT_FORMAT_REGISTRY } from '../../../constants/contentFormatRegistry'
import { usePlatformConstraints } from '../../../hooks/usePlatformConstraints'
import type {
  AudioAdvancedOptions,
  ContentCategory,
  ContentFormat,
  ImageAdvancedOptions,
  LengthConfig,
  RepurposingSource,
  StudioMode,
  StudioPlatform,
  StudioTemplate,
  StudioTone,
  StudioValidationErrors,
  TextAdvancedOptions,
  VideoAdvancedOptions,
  VoiceOption,
} from '../../../types'

import { StudioModeToggle } from './StudioModeToggle'
import { ContentCategoryTabs } from './ContentCategoryTabs'
import { ContentFormatGrid } from './ContentFormatGrid'
import { PromptInput } from './PromptInput'
import { PlatformSelector } from './PlatformSelector'
import { PlatformConstraintHint } from './PlatformConstraintHint'
import { ToneSelector } from './ToneSelector'
import { LengthSelector } from './LengthSelector'
import { AdvancedOptionsPanel } from './AdvancedOptionsPanel'
import { TemplateLibrary } from './TemplateLibrary'
import { CreditEstimateBar } from './CreditEstimateBar'
import { StudioActions } from './StudioActions'
import { RepurposingSourcePicker } from './RepurposingSourcePicker'
import { SourceAssetPreview } from './SourceAssetPreview'
import { RepurposingTargetSelector } from './RepurposingTargetSelector'
import { RepurposingInstructionsInput } from './RepurposingInstructionsInput'

// ─── Prompt placeholder map ───────────────────────────────────────────────────

const PROMPT_PLACEHOLDERS: Record<ContentCategory, string> = {
  text: 'Describe the content you want to create — topic, key points, audience…',
  image: 'Describe the scene you want to illustrate — subject, style, mood…',
  video: 'Write a script for a 60-second explainer, or describe the video concept…',
  audio: 'Describe the audio content — topic, tone, key talking points…',
  story: 'Describe the story you want to tell — narrative arc, characters, setting…',
}

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * All props accepted by ConfigurationPanel.
 *
 * The panel accepts all state and setters from useStudioState as props so that
 * the parent page (ContentGenerationStudio, task 15) can wire them up. For now
 * the panel is self-contained and can be rendered with stub values.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 14.5, 15.2
 */
export interface ConfigurationPanelProps {
  // ── Identity ──────────────────────────────────────────────────────────────
  teamId: string
  userId: string

  // ── Mode ──────────────────────────────────────────────────────────────────
  mode: StudioMode
  setMode: (mode: StudioMode) => void

  // ── Draft config ──────────────────────────────────────────────────────────
  prompt: string
  setPrompt: (v: string) => void
  contentCategory: ContentCategory
  setContentCategory: (v: ContentCategory) => void
  contentFormat: ContentFormat
  setContentFormat: (v: ContentFormat) => void
  platform: StudioPlatform
  setPlatform: (v: StudioPlatform) => void
  tone: StudioTone
  setTone: (v: StudioTone) => void
  length: LengthConfig
  setLength: (v: LengthConfig) => void

  // ── Advanced options ──────────────────────────────────────────────────────
  textOptions: TextAdvancedOptions
  setTextOptions: (v: TextAdvancedOptions) => void
  imageOptions: ImageAdvancedOptions
  setImageOptions: (v: ImageAdvancedOptions) => void
  videoOptions: VideoAdvancedOptions
  setVideoOptions: (v: VideoAdvancedOptions) => void
  audioOptions: AudioAdvancedOptions
  setAudioOptions: (v: AudioAdvancedOptions) => void

  // ── Repurposing ───────────────────────────────────────────────────────────
  repurposingSource: RepurposingSource | null
  setRepurposingSource: (v: RepurposingSource | null) => void
  repurposingTarget: ContentFormat | null
  setRepurposingTarget: (v: ContentFormat | null) => void
  repurposingInstructions: string
  setRepurposingInstructions: (v: string) => void

  // ── Validation ────────────────────────────────────────────────────────────
  validationErrors: StudioValidationErrors

  // ── Template ──────────────────────────────────────────────────────────────
  applyTemplate: (template: StudioTemplate) => void

  // ── Credit estimate ───────────────────────────────────────────────────────
  estimatedCost: number | null
  balance: number | null
  isCreditLoading: boolean
  isCreditUnavailable: boolean

  // ── Actions ───────────────────────────────────────────────────────────────
  canGenerate: boolean
  isGenerating: boolean
  onGenerate: () => void
  onSaveAsPipeline: () => void

  // ── Brand voice ───────────────────────────────────────────────────────────
  brandVoiceActive: boolean

  // ── Voices (for AdvancedOptionsPanel audio sub-panel) ────────────────────
  voices?: VoiceOption[]
  voicesLoading?: boolean
  voicesFailed?: boolean
  onRetryVoices?: () => void

  // ── Credit cost per category (for ContentCategoryTabs) ───────────────────
  creditsByCategory?: Partial<Record<ContentCategory, number>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives the list of available platforms for the currently selected format.
 * Falls back to all platforms when the registry entry is missing.
 */
function getAvailablePlatforms(format: ContentFormat): StudioPlatform[] {
  return CONTENT_FORMAT_REGISTRY[format]?.compatiblePlatforms ?? [
    'Instagram', 'LinkedIn', 'Twitter / X', 'Facebook',
    'YouTube', 'TikTok', 'Blog', 'Newsletter', 'Podcast', 'General',
  ]
}

/**
 * Derives the available platforms for repurpose mode based on the selected
 * target format. Falls back to all platforms when no target is selected.
 */
function getRepurposeAvailablePlatforms(target: ContentFormat | null): StudioPlatform[] {
  if (!target) {
    return [
      'Instagram', 'LinkedIn', 'Twitter / X', 'Facebook',
      'YouTube', 'TikTok', 'Blog', 'Newsletter', 'Podcast', 'General',
    ]
  }
  return getAvailablePlatforms(target)
}

// ─── Section label helper ─────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
    {children}
  </p>
)

// ─── ConfigurationPanel ───────────────────────────────────────────────────────

/**
 * ConfigurationPanel
 *
 * The left panel of the Content Generation Studio. Renders different controls
 * depending on the active `mode`:
 *
 * **Create mode** (`mode === 'create'`):
 *   ContentCategoryTabs → ContentFormatGrid → PromptInput → PlatformSelector
 *   → PlatformConstraintHint → ToneSelector → LengthSelector
 *   → AdvancedOptionsPanel → TemplateLibrary
 *
 * **Repurpose mode** (`mode === 'repurpose'`):
 *   RepurposingSourcePicker → SourceAssetPreview → RepurposingTargetSelector
 *   → RepurposingInstructionsInput → PlatformSelector → ToneSelector
 *
 * **Both modes** (always rendered):
 *   StudioModeToggle (top) → CreditEstimateBar + StudioActions (bottom)
 *
 * When the Generate button is clicked in repurpose mode, `buildMetadata()`
 * (called by the parent) will populate `metadata.sourceJobId` or
 * `metadata.sourceMediaId` alongside the standard ContentFormatMetadataSchema
 * fields, creating a RepurposingJob (Requirement 14.5).
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 14.5, 15.2
 */
export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  // Identity
  teamId,
  userId,

  // Mode
  mode,
  setMode,

  // Draft config
  prompt,
  setPrompt,
  contentCategory,
  setContentCategory,
  contentFormat,
  setContentFormat,
  platform,
  setPlatform,
  tone,
  setTone,
  length,
  setLength,

  // Advanced options
  textOptions,
  setTextOptions,
  imageOptions,
  setImageOptions,
  videoOptions,
  setVideoOptions,
  audioOptions,
  setAudioOptions,

  // Repurposing
  repurposingSource,
  setRepurposingSource,
  repurposingTarget,
  setRepurposingTarget,
  repurposingInstructions,
  setRepurposingInstructions,

  // Validation
  validationErrors,

  // Template
  applyTemplate,

  // Credit estimate
  estimatedCost,
  balance,
  isCreditLoading,
  isCreditUnavailable,

  // Actions
  canGenerate,
  isGenerating,
  onGenerate,
  onSaveAsPipeline,

  // Brand voice
  brandVoiceActive,

  // Voices
  voices = [],
  voicesLoading = false,
  voicesFailed = false,
  onRetryVoices = () => {},

  // Credits per category
  creditsByCategory = {},
}) => {
  // ── Derived values ─────────────────────────────────────────────────────────

  // Available platforms for create mode (driven by selected format)
  const createAvailablePlatforms = useMemo(
    () => getAvailablePlatforms(contentFormat),
    [contentFormat],
  )

  // Available platforms for repurpose mode (driven by selected target format)
  const repurposeAvailablePlatforms = useMemo(
    () => getRepurposeAvailablePlatforms(repurposingTarget),
    [repurposingTarget],
  )

  // Platform constraints for the constraint hint (create mode only)
  const platformConstraints = usePlatformConstraints(contentFormat, platform)

  // Prompt placeholder text — changes with contentCategory (Requirement 2.2)
  const promptPlaceholder = PROMPT_PLACEHOLDERS[contentCategory]

  // Current draft config snapshot for TemplateLibrary
  const currentConfig = useMemo(
    () => ({
      prompt,
      contentCategory,
      contentFormat,
      platform,
      tone,
      length,
    }),
    [prompt, contentCategory, contentFormat, platform, tone, length],
  )

  // Source format for RepurposingTargetSelector — derived from selected source
  const sourceFormat: ContentFormat | null = repurposingSource?.format ?? null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col gap-5 h-full"
      aria-label="Studio configuration panel"
    >
      {/* ── Mode toggle (always visible) ─────────────────────────────────── */}
      <div className="flex items-center justify-center">
        <StudioModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* ── Scrollable content area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-5 overflow-y-auto min-h-0 pr-1">

        {/* ════════════════════════════════════════════════════════════════
            CREATE MODE
            ════════════════════════════════════════════════════════════════ */}
        {mode === 'create' && (
          <>
            {/* Content category tabs */}
            <section aria-label="Content category">
              <ContentCategoryTabs
                selected={contentCategory}
                creditsByCategory={creditsByCategory}
                creditsUnavailable={isCreditUnavailable}
                onChange={setContentCategory}
              />
            </section>

            {/* Content format grid */}
            <section aria-label="Content format">
              <SectionLabel>Format</SectionLabel>
              <div className="mt-2">
                <ContentFormatGrid
                  category={contentCategory}
                  selected={contentFormat}
                  onChange={setContentFormat}
                />
              </div>
            </section>

            {/* Prompt input */}
            <section aria-label="Prompt">
              <SectionLabel>Prompt</SectionLabel>
              <div className="mt-2">
                <PromptInput
                  value={prompt}
                  onChange={setPrompt}
                  placeholder={promptPlaceholder}
                  maxLength={4000}
                  error={validationErrors.prompt}
                />
              </div>
            </section>

            {/* Platform selector + constraint hint */}
            <section aria-label="Platform">
              <SectionLabel>Platform</SectionLabel>
              <div className="mt-2 flex flex-col gap-2">
                <PlatformSelector
                  selected={platform}
                  availablePlatforms={createAvailablePlatforms}
                  onChange={setPlatform}
                />
                <PlatformConstraintHint
                  format={contentFormat}
                  platform={platform}
                  constraints={platformConstraints}
                />
              </div>
            </section>

            {/* Tone selector */}
            <section aria-label="Tone">
              <SectionLabel>Tone</SectionLabel>
              <div className="mt-2">
                <ToneSelector
                  selected={tone}
                  brandVoiceActive={brandVoiceActive}
                  onChange={setTone}
                />
              </div>
            </section>

            {/* Length selector */}
            <section aria-label="Length">
              <SectionLabel>Length</SectionLabel>
              <div className="mt-2">
                <LengthSelector
                  category={contentCategory}
                  value={length}
                  onChange={setLength}
                  error={validationErrors.length}
                />
              </div>
            </section>

            {/* Advanced options */}
            <section aria-label="Advanced options">
              <AdvancedOptionsPanel
                category={contentCategory}
                textOptions={textOptions}
                imageOptions={imageOptions}
                videoOptions={videoOptions}
                audioOptions={audioOptions}
                onTextChange={setTextOptions}
                onImageChange={setImageOptions}
                onVideoChange={setVideoOptions}
                onAudioChange={setAudioOptions}
                voices={voices}
                voicesLoading={voicesLoading}
                voicesFailed={voicesFailed}
                onRetryVoices={onRetryVoices}
              />
            </section>

            {/* Template library */}
            <section aria-label="Templates">
              <TemplateLibrary
                teamId={teamId}
                onApply={applyTemplate}
                currentConfig={currentConfig}
              />
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            REPURPOSE MODE
            ════════════════════════════════════════════════════════════════ */}
        {mode === 'repurpose' && (
          <>
            {/* Source picker */}
            <section aria-label="Source asset">
              <SectionLabel>Select Source</SectionLabel>
              <div className="mt-2">
                <RepurposingSourcePicker
                  teamId={teamId}
                  userId={userId}
                  selectedSource={repurposingSource}
                  onSelect={setRepurposingSource}
                />
              </div>
              {validationErrors.repurposingSource && (
                <p
                  role="alert"
                  className="mt-1 text-xs font-medium text-red-500 dark:text-red-400"
                >
                  {validationErrors.repurposingSource}
                </p>
              )}
            </section>

            {/* Source asset preview — only shown when a source is selected */}
            {repurposingSource && (
              <section aria-label="Source preview">
                <SourceAssetPreview source={repurposingSource} />
              </section>
            )}

            {/* Target format selector — only shown when source has a known format */}
            {sourceFormat && (
              <section aria-label="Target format">
                <SectionLabel>Repurpose To</SectionLabel>
                <div className="mt-2">
                  <RepurposingTargetSelector
                    sourceFormat={sourceFormat}
                    selected={repurposingTarget}
                    onChange={setRepurposingTarget}
                  />
                </div>
                {validationErrors.repurposingTarget && (
                  <p
                    role="alert"
                    className="mt-1 text-xs font-medium text-red-500 dark:text-red-400"
                  >
                    {validationErrors.repurposingTarget}
                  </p>
                )}
              </section>
            )}

            {/* Additional instructions */}
            <section aria-label="Repurposing instructions">
              <RepurposingInstructionsInput
                value={repurposingInstructions}
                onChange={setRepurposingInstructions}
              />
            </section>

            {/* Platform selector */}
            <section aria-label="Platform">
              <SectionLabel>Platform</SectionLabel>
              <div className="mt-2">
                <PlatformSelector
                  selected={platform}
                  availablePlatforms={repurposeAvailablePlatforms}
                  onChange={setPlatform}
                />
              </div>
            </section>

            {/* Tone selector */}
            <section aria-label="Tone">
              <SectionLabel>Tone</SectionLabel>
              <div className="mt-2">
                <ToneSelector
                  selected={tone}
                  brandVoiceActive={brandVoiceActive}
                  onChange={setTone}
                />
              </div>
            </section>
          </>
        )}
      </div>

      {/* ── Bottom bar: credit estimate + actions (always visible) ────────── */}
      <div className="flex flex-col gap-3 pt-2 border-t border-gray-200/50 dark:border-white/10">
        <CreditEstimateBar
          estimatedCost={estimatedCost}
          balance={balance}
          isLoading={isCreditLoading}
          isUnavailable={isCreditUnavailable}
        />
        <StudioActions
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          onGenerate={onGenerate}
          onSaveAsPipeline={onSaveAsPipeline}
        />
      </div>
    </div>
  )
}

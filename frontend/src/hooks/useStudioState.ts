import { useCallback, useEffect, useRef, useState } from 'react'
import { CONTENT_FORMAT_REGISTRY, CONTENT_FORMATS_PHASE1 } from '../constants/contentFormatRegistry'
import type {
  AudioAdvancedOptions,
  ContentCategory,
  ContentFormat,
  ContentFormatMetadataSchema,
  ContentJob,
  ImageAdvancedOptions,
  LengthConfig,
  RepurposingSource,
  StudioDraftConfig,
  StudioMode,
  StudioPlatform,
  StudioTemplate,
  StudioTone,
  StudioValidationErrors,
  TextAdvancedOptions,
  VideoAdvancedOptions,
} from '../types'
import {
  DEFAULT_AUDIO_OPTIONS,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_TEXT_OPTIONS,
  DEFAULT_VIDEO_OPTIONS,
} from '../types'

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONTENT_CATEGORY: ContentCategory = 'text'
const DEFAULT_CONTENT_FORMAT: ContentFormat = 'tweet'
const DEFAULT_PLATFORM: StudioPlatform = 'General'
const DEFAULT_TONE: StudioTone = 'Professional'
const DEFAULT_LENGTH: LengthConfig = {
  preset: 'medium',
  minWords: null,
  maxWords: null,
  durationSeconds: null,
  quantity: null,
  speakingRate: null,
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function getDraftConfigKey(teamId: string): string {
  return `${teamId}:studio:draftConfig`
}

function getAdvancedOptionsKey(teamId: string, contentType: string): string {
  return `${teamId}:${contentType}:advancedOptions`
}

function readDraftConfig(teamId: string): StudioDraftConfig {
  try {
    const raw = localStorage.getItem(getDraftConfigKey(teamId))
    if (!raw) return buildDefaultDraftConfig()
    const parsed = JSON.parse(raw) as Partial<StudioDraftConfig>

    // Validate contentFormat is a Phase 1 key; fall back to defaults if not
    const contentFormat: ContentFormat =
      parsed.contentFormat && (CONTENT_FORMATS_PHASE1 as string[]).includes(parsed.contentFormat)
        ? parsed.contentFormat
        : DEFAULT_CONTENT_FORMAT

    // Derive contentCategory from the registry if the stored one is missing/invalid
    const validCategories: ContentCategory[] = ['text', 'image', 'video', 'audio', 'story']
    const contentCategory: ContentCategory =
      parsed.contentCategory && validCategories.includes(parsed.contentCategory)
        ? parsed.contentCategory
        : (CONTENT_FORMAT_REGISTRY[contentFormat]?.category ?? DEFAULT_CONTENT_CATEGORY)

    const validPlatforms: StudioPlatform[] = [
      'Instagram', 'LinkedIn', 'Twitter / X', 'Facebook',
      'YouTube', 'TikTok', 'Blog', 'Newsletter', 'Podcast', 'General',
    ]
    const platform: StudioPlatform =
      parsed.platform && validPlatforms.includes(parsed.platform)
        ? parsed.platform
        : DEFAULT_PLATFORM

    const validTones: StudioTone[] = [
      'Professional', 'Casual', 'Humorous', 'Inspirational', 'Persuasive', 'Informative',
    ]
    const tone: StudioTone =
      parsed.tone && validTones.includes(parsed.tone) ? parsed.tone : DEFAULT_TONE

    const length: LengthConfig = isValidLengthConfig(parsed.length)
      ? parsed.length
      : DEFAULT_LENGTH

    return {
      prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
      contentCategory,
      contentFormat,
      platform,
      tone,
      length,
    }
  } catch {
    return buildDefaultDraftConfig()
  }
}

function buildDefaultDraftConfig(): StudioDraftConfig {
  return {
    prompt: '',
    contentCategory: DEFAULT_CONTENT_CATEGORY,
    contentFormat: DEFAULT_CONTENT_FORMAT,
    platform: DEFAULT_PLATFORM,
    tone: DEFAULT_TONE,
    length: { ...DEFAULT_LENGTH },
  }
}

function isValidLengthConfig(value: unknown): value is LengthConfig {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const validPresets = ['short', 'medium', 'long', 'custom', null]
  return validPresets.includes(v.preset as string | null)
}

function readAdvancedOptions<T>(teamId: string, contentType: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(getAdvancedOptionsKey(teamId, contentType))
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<T>
    // Merge with defaults so missing keys fall back gracefully
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

function writeAdvancedOptions<T>(teamId: string, contentType: string, value: T): void {
  try {
    localStorage.setItem(getAdvancedOptionsKey(teamId, contentType), JSON.stringify(value))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ─── Return interface ─────────────────────────────────────────────────────────

export interface UseStudioStateReturn {
  // Mode
  mode: StudioMode
  setMode: (mode: StudioMode) => void

  // Draft config (persisted)
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

  // Advanced options (persisted separately, existing pattern)
  textOptions: TextAdvancedOptions
  setTextOptions: (v: TextAdvancedOptions) => void
  imageOptions: ImageAdvancedOptions
  setImageOptions: (v: ImageAdvancedOptions) => void
  videoOptions: VideoAdvancedOptions
  setVideoOptions: (v: VideoAdvancedOptions) => void
  audioOptions: AudioAdvancedOptions
  setAudioOptions: (v: AudioAdvancedOptions) => void

  // Repurposing
  repurposingSource: RepurposingSource | null
  setRepurposingSource: (v: RepurposingSource | null) => void
  repurposingTarget: ContentFormat | null
  setRepurposingTarget: (v: ContentFormat | null) => void
  repurposingInstructions: string
  setRepurposingInstructions: (v: string) => void

  // Active job
  activeJob: ContentJob | null
  setActiveJob: (job: ContentJob | null) => void
  isGenerating: boolean
  setIsGenerating: (v: boolean) => void

  // Validation
  validationErrors: StudioValidationErrors
  validateBeforeGenerate: () => boolean

  // Actions
  buildMetadata: () => ContentFormatMetadataSchema
  clearDraft: () => void
  applyTemplate: (template: StudioTemplate) => void
  reuseJobConfig: (job: ContentJob) => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudioState(teamId: string | null): UseStudioStateReturn {
  // ── Initialise from localStorage on first render ──────────────────────────
  const initialDraft = teamId ? readDraftConfig(teamId) : buildDefaultDraftConfig()

  // Mode (not persisted)
  const [mode, setMode] = useState<StudioMode>('create')

  // Draft config fields
  const [prompt, setPromptState] = useState<string>(initialDraft.prompt)
  const [contentCategory, setContentCategoryState] = useState<ContentCategory>(
    initialDraft.contentCategory,
  )
  const [contentFormat, setContentFormatState] = useState<ContentFormat>(
    initialDraft.contentFormat,
  )
  const [platform, setPlatformState] = useState<StudioPlatform>(initialDraft.platform)
  const [tone, setToneState] = useState<StudioTone>(initialDraft.tone)
  const [length, setLengthState] = useState<LengthConfig>(initialDraft.length)

  // Advanced options (read from per-type localStorage keys)
  const [textOptions, setTextOptionsState] = useState<TextAdvancedOptions>(() =>
    teamId ? readAdvancedOptions(teamId, 'text', DEFAULT_TEXT_OPTIONS) : DEFAULT_TEXT_OPTIONS,
  )
  const [imageOptions, setImageOptionsState] = useState<ImageAdvancedOptions>(() =>
    teamId ? readAdvancedOptions(teamId, 'image', DEFAULT_IMAGE_OPTIONS) : DEFAULT_IMAGE_OPTIONS,
  )
  const [videoOptions, setVideoOptionsState] = useState<VideoAdvancedOptions>(() =>
    teamId ? readAdvancedOptions(teamId, 'video', DEFAULT_VIDEO_OPTIONS) : DEFAULT_VIDEO_OPTIONS,
  )
  const [audioOptions, setAudioOptionsState] = useState<AudioAdvancedOptions>(() =>
    teamId ? readAdvancedOptions(teamId, 'audio', DEFAULT_AUDIO_OPTIONS) : DEFAULT_AUDIO_OPTIONS,
  )

  // Repurposing (not persisted)
  const [repurposingSource, setRepurposingSource] = useState<RepurposingSource | null>(null)
  const [repurposingTarget, setRepurposingTarget] = useState<ContentFormat | null>(null)
  const [repurposingInstructions, setRepurposingInstructions] = useState<string>('')

  // Active job (not persisted)
  const [activeJob, setActiveJob] = useState<ContentJob | null>(null)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<StudioValidationErrors>({})

  // ── Re-read localStorage when teamId changes ──────────────────────────────
  const prevTeamIdRef = useRef<string | null>(teamId)
  useEffect(() => {
    if (prevTeamIdRef.current === teamId) return
    prevTeamIdRef.current = teamId

    if (!teamId) {
      const defaults = buildDefaultDraftConfig()
      setPromptState(defaults.prompt)
      setContentCategoryState(defaults.contentCategory)
      setContentFormatState(defaults.contentFormat)
      setPlatformState(defaults.platform)
      setToneState(defaults.tone)
      setLengthState(defaults.length)
      setTextOptionsState(DEFAULT_TEXT_OPTIONS)
      setImageOptionsState(DEFAULT_IMAGE_OPTIONS)
      setVideoOptionsState(DEFAULT_VIDEO_OPTIONS)
      setAudioOptionsState(DEFAULT_AUDIO_OPTIONS)
      return
    }

    const draft = readDraftConfig(teamId)
    setPromptState(draft.prompt)
    setContentCategoryState(draft.contentCategory)
    setContentFormatState(draft.contentFormat)
    setPlatformState(draft.platform)
    setToneState(draft.tone)
    setLengthState(draft.length)
    setTextOptionsState(readAdvancedOptions(teamId, 'text', DEFAULT_TEXT_OPTIONS))
    setImageOptionsState(readAdvancedOptions(teamId, 'image', DEFAULT_IMAGE_OPTIONS))
    setVideoOptionsState(readAdvancedOptions(teamId, 'video', DEFAULT_VIDEO_OPTIONS))
    setAudioOptionsState(readAdvancedOptions(teamId, 'audio', DEFAULT_AUDIO_OPTIONS))
  }, [teamId])

  // ── Debounced draft config persistence ───────────────────────────────────
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistDraftConfig = useCallback(
    (config: StudioDraftConfig) => {
      if (!teamId) return
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(getDraftConfigKey(teamId), JSON.stringify(config))
        } catch {
          // localStorage unavailable — silently ignore
        }
      }, 500)
    },
    [teamId],
  )

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // ── Setters that also trigger persistence ─────────────────────────────────

  // Helper to build the current draft config snapshot
  const buildDraftSnapshot = useCallback(
    (overrides: Partial<StudioDraftConfig> = {}): StudioDraftConfig => ({
      prompt,
      contentCategory,
      contentFormat,
      platform,
      tone,
      length,
      ...overrides,
    }),
    [prompt, contentCategory, contentFormat, platform, tone, length],
  )

  const setPrompt = useCallback(
    (v: string) => {
      setPromptState(v)
      persistDraftConfig(buildDraftSnapshot({ prompt: v }))
    },
    [buildDraftSnapshot, persistDraftConfig],
  )

  const setContentCategory = useCallback(
    (v: ContentCategory) => {
      setContentCategoryState(v)
      persistDraftConfig(buildDraftSnapshot({ contentCategory: v }))
    },
    [buildDraftSnapshot, persistDraftConfig],
  )

  const setContentFormat = useCallback(
    (v: ContentFormat) => {
      setContentFormatState(v)
      persistDraftConfig(buildDraftSnapshot({ contentFormat: v }))
    },
    [buildDraftSnapshot, persistDraftConfig],
  )

  const setPlatform = useCallback(
    (v: StudioPlatform) => {
      setPlatformState(v)
      persistDraftConfig(buildDraftSnapshot({ platform: v }))
    },
    [buildDraftSnapshot, persistDraftConfig],
  )

  const setTone = useCallback(
    (v: StudioTone) => {
      setToneState(v)
      persistDraftConfig(buildDraftSnapshot({ tone: v }))
    },
    [buildDraftSnapshot, persistDraftConfig],
  )

  const setLength = useCallback(
    (v: LengthConfig) => {
      setLengthState(v)
      persistDraftConfig(buildDraftSnapshot({ length: v }))
    },
    [buildDraftSnapshot, persistDraftConfig],
  )

  // Advanced options setters — persist to per-type keys immediately
  const setTextOptions = useCallback(
    (v: TextAdvancedOptions) => {
      setTextOptionsState(v)
      if (teamId) writeAdvancedOptions(teamId, 'text', v)
    },
    [teamId],
  )

  const setImageOptions = useCallback(
    (v: ImageAdvancedOptions) => {
      setImageOptionsState(v)
      if (teamId) writeAdvancedOptions(teamId, 'image', v)
    },
    [teamId],
  )

  const setVideoOptions = useCallback(
    (v: VideoAdvancedOptions) => {
      setVideoOptionsState(v)
      if (teamId) writeAdvancedOptions(teamId, 'video', v)
    },
    [teamId],
  )

  const setAudioOptions = useCallback(
    (v: AudioAdvancedOptions) => {
      setAudioOptionsState(v)
      if (teamId) writeAdvancedOptions(teamId, 'audio', v)
    },
    [teamId],
  )

  // ── buildMetadata ─────────────────────────────────────────────────────────

  const buildMetadata = useCallback((): ContentFormatMetadataSchema => {
    // Derive platform constraints from the registry
    const registryEntry = CONTENT_FORMAT_REGISTRY[contentFormat]
    const platformConstraints = registryEntry?.constraints[platform] ?? {
      characterLimit: null,
      aspectRatio: null,
      durationLimitSeconds: null,
      fileSizeLimitMb: null,
      acceptedFileFormats: [],
    }

    // Flatten advanced options into the unified schema shape
    const advancedOptions: ContentFormatMetadataSchema['advancedOptions'] = {
      model:
        contentCategory === 'text'
          ? textOptions.model
          : contentCategory === 'video'
            ? videoOptions.model
            : null,
      resolution: contentCategory === 'image' ? imageOptions.resolution : null,
      style: contentCategory === 'image' ? imageOptions.style : null,
      negativePrompt: contentCategory === 'image' ? imageOptions.negativePrompt : null,
      seed: contentCategory === 'image' ? imageOptions.seed : null,
      voice: contentCategory === 'audio' ? audioOptions.voiceId : null,
      pitch: contentCategory === 'audio' ? audioOptions.pitchAdjustment : null,
      stability: contentCategory === 'audio' ? audioOptions.stabilityClarity : null,
      outputFormat:
        contentCategory === 'audio'
          ? audioOptions.outputFormat
          : null,
      aspectRatio: contentCategory === 'video' ? videoOptions.aspectRatio : null,
      includeBRoll: contentCategory === 'video' ? videoOptions.includeBRoll : null,
      brandVoice:
        contentCategory === 'text'
          ? textOptions.brandVoiceEnabled
          : contentCategory === 'video'
            ? videoOptions.brandVoiceEnabled
            : null,
      language: contentCategory === 'text' ? textOptions.language : null,
    }

    return {
      contentCategory,
      contentFormat,
      platform,
      tone,
      length,
      advancedOptions,
      platformConstraints,
      sourceJobId: repurposingSource?.type === 'job' ? repurposingSource.id : null,
      sourceMediaId: repurposingSource?.type === 'media' ? repurposingSource.id : null,
      repurposingInstructions: repurposingInstructions || null,
      schemaVersion: '1',
    }
  }, [
    contentCategory,
    contentFormat,
    platform,
    tone,
    length,
    textOptions,
    imageOptions,
    videoOptions,
    audioOptions,
    repurposingSource,
    repurposingInstructions,
  ])

  // ── validateBeforeGenerate ────────────────────────────────────────────────

  const validateBeforeGenerate = useCallback((): boolean => {
    const errors: StudioValidationErrors = {}

    if (prompt.trim().length === 0) {
      errors.prompt = 'Prompt is required'
    } else if (prompt.length > 4000) {
      errors.prompt = 'Prompt exceeds 4,000 characters'
    }

    if (
      length.preset === 'custom' &&
      length.maxWords !== null &&
      length.minWords !== null &&
      length.maxWords < length.minWords
    ) {
      errors.length = 'Maximum word count must be ≥ minimum'
    }

    if (mode === 'repurpose') {
      if (!repurposingSource) {
        errors.repurposingSource = 'Please select a source asset'
      }
      if (!repurposingTarget) {
        errors.repurposingTarget = 'Please select a target format'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [prompt, length, mode, repurposingSource, repurposingTarget])

  // ── applyTemplate ─────────────────────────────────────────────────────────

  const applyTemplate = useCallback(
    (template: StudioTemplate) => {
      const newPrompt = template.prompt_template
      const newCategory = template.content_category
      const newFormat = template.content_format
      const newPlatform = template.platform
      const newTone = template.tone

      setPromptState(newPrompt)
      setContentCategoryState(newCategory)
      setContentFormatState(newFormat)
      setPlatformState(newPlatform)
      setToneState(newTone)

      // Apply advanced options from the template
      if (template.advanced_options) {
        const ao = template.advanced_options
        // Map the unified schema shape back to per-type options
        if (newCategory === 'text') {
          setTextOptions({
            ...textOptions,
            model: (ao.model as TextAdvancedOptions['model']) ?? textOptions.model,
            brandVoiceEnabled: ao.brandVoice ?? textOptions.brandVoiceEnabled,
            language: ao.language ?? textOptions.language,
          })
        } else if (newCategory === 'image') {
          setImageOptions({
            ...imageOptions,
            resolution:
              (ao.resolution as ImageAdvancedOptions['resolution']) ?? imageOptions.resolution,
            style: (ao.style as ImageAdvancedOptions['style']) ?? imageOptions.style,
            negativePrompt: ao.negativePrompt ?? imageOptions.negativePrompt,
            seed: ao.seed ?? imageOptions.seed,
          })
        } else if (newCategory === 'video') {
          setVideoOptions({
            ...videoOptions,
            model: (ao.model as VideoAdvancedOptions['model']) ?? videoOptions.model,
            aspectRatio:
              (ao.aspectRatio as VideoAdvancedOptions['aspectRatio']) ?? videoOptions.aspectRatio,
            includeBRoll: ao.includeBRoll ?? videoOptions.includeBRoll,
            brandVoiceEnabled: ao.brandVoice ?? videoOptions.brandVoiceEnabled,
          })
        } else if (newCategory === 'audio') {
          setAudioOptions({
            ...audioOptions,
            voiceId: ao.voice ?? audioOptions.voiceId,
            pitchAdjustment: ao.pitch ?? audioOptions.pitchAdjustment,
            stabilityClarity: ao.stability ?? audioOptions.stabilityClarity,
            outputFormat:
              (ao.outputFormat as AudioAdvancedOptions['outputFormat']) ?? audioOptions.outputFormat,
          })
        }
      }

      // Persist the new draft config
      const newDraft: StudioDraftConfig = {
        prompt: newPrompt,
        contentCategory: newCategory,
        contentFormat: newFormat,
        platform: newPlatform,
        tone: newTone,
        length,
      }
      persistDraftConfig(newDraft)
    },
    [
      textOptions,
      imageOptions,
      videoOptions,
      audioOptions,
      length,
      persistDraftConfig,
      setTextOptions,
      setImageOptions,
      setVideoOptions,
      setAudioOptions,
    ],
  )

  // ── reuseJobConfig ────────────────────────────────────────────────────────

  const reuseJobConfig = useCallback(
    (job: ContentJob) => {
      const meta = job.metadata as Partial<ContentFormatMetadataSchema>

      const newPrompt = job.prompt
      const newCategory: ContentCategory =
        (meta.contentCategory as ContentCategory) ?? DEFAULT_CONTENT_CATEGORY
      // Legacy fallback: if contentFormat is absent in metadata, keep current contentFormat
      const newFormat: ContentFormat =
        meta.contentFormat &&
        (CONTENT_FORMATS_PHASE1 as string[]).includes(meta.contentFormat as string)
          ? (meta.contentFormat as ContentFormat)
          : contentFormat
      const newPlatform: StudioPlatform =
        (meta.platform as StudioPlatform) ?? DEFAULT_PLATFORM
      const newTone: StudioTone = (meta.tone as StudioTone) ?? DEFAULT_TONE
      const newLength: LengthConfig = isValidLengthConfig(meta.length)
        ? meta.length
        : DEFAULT_LENGTH

      setPromptState(newPrompt)
      setContentCategoryState(newCategory)
      setContentFormatState(newFormat)
      setPlatformState(newPlatform)
      setToneState(newTone)
      setLengthState(newLength)

      // Restore advanced options from metadata
      if (meta.advancedOptions) {
        const ao = meta.advancedOptions
        if (newCategory === 'text') {
          setTextOptions({
            ...textOptions,
            model: (ao.model as TextAdvancedOptions['model']) ?? textOptions.model,
            brandVoiceEnabled: ao.brandVoice ?? textOptions.brandVoiceEnabled,
            language: ao.language ?? textOptions.language,
          })
        } else if (newCategory === 'image') {
          setImageOptions({
            ...imageOptions,
            resolution:
              (ao.resolution as ImageAdvancedOptions['resolution']) ?? imageOptions.resolution,
            style: (ao.style as ImageAdvancedOptions['style']) ?? imageOptions.style,
            negativePrompt: ao.negativePrompt ?? imageOptions.negativePrompt,
            seed: ao.seed ?? imageOptions.seed,
          })
        } else if (newCategory === 'video') {
          setVideoOptions({
            ...videoOptions,
            model: (ao.model as VideoAdvancedOptions['model']) ?? videoOptions.model,
            aspectRatio:
              (ao.aspectRatio as VideoAdvancedOptions['aspectRatio']) ?? videoOptions.aspectRatio,
            includeBRoll: ao.includeBRoll ?? videoOptions.includeBRoll,
            brandVoiceEnabled: ao.brandVoice ?? videoOptions.brandVoiceEnabled,
          })
        } else if (newCategory === 'audio') {
          setAudioOptions({
            ...audioOptions,
            voiceId: ao.voice ?? audioOptions.voiceId,
            pitchAdjustment: ao.pitch ?? audioOptions.pitchAdjustment,
            stabilityClarity: ao.stability ?? audioOptions.stabilityClarity,
            outputFormat:
              (ao.outputFormat as AudioAdvancedOptions['outputFormat']) ?? audioOptions.outputFormat,
          })
        }
      }

      const newDraft: StudioDraftConfig = {
        prompt: newPrompt,
        contentCategory: newCategory,
        contentFormat: newFormat,
        platform: newPlatform,
        tone: newTone,
        length: newLength,
      }
      persistDraftConfig(newDraft)
    },
    [
      contentFormat,
      textOptions,
      imageOptions,
      videoOptions,
      audioOptions,
      persistDraftConfig,
      setTextOptions,
      setImageOptions,
      setVideoOptions,
      setAudioOptions,
    ],
  )

  // ── clearDraft ────────────────────────────────────────────────────────────

  const clearDraft = useCallback(() => {
    if (teamId) {
      try {
        localStorage.removeItem(getDraftConfigKey(teamId))
      } catch {
        // localStorage unavailable — silently ignore
      }
    }
    const defaults = buildDefaultDraftConfig()
    setPromptState(defaults.prompt)
    setContentCategoryState(defaults.contentCategory)
    setContentFormatState(defaults.contentFormat)
    setPlatformState(defaults.platform)
    setToneState(defaults.tone)
    setLengthState(defaults.length)
    setValidationErrors({})
  }, [teamId])

  // ─────────────────────────────────────────────────────────────────────────

  return {
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

    // Active job
    activeJob,
    setActiveJob,
    isGenerating,
    setIsGenerating,

    // Validation
    validationErrors,
    validateBeforeGenerate,

    // Actions
    buildMetadata,
    clearDraft,
    applyTemplate,
    reuseJobConfig,
  }
}

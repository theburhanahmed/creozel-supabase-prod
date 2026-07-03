import React, { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  SparklesIcon,
  XCircleIcon,
  FolderIcon,
  AlertCircleIcon,
  Loader2Icon,
  ChevronDownIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { StatusBadge } from '../../components/content/StatusBadge'
import { TextResultViewer } from '../../components/content/ResultViewer'
import { useAppContext } from '../../context/AppContext'
import {
  createContentJob,
  subscribeToJob,
  cancelJob,
  getPricingConfig,
  getRecentJobs,
} from '../../services/contentService'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../utils/errorReporter'
import type { ContentJob, ContentType, PricingConfig } from '../../types'
import {
  TextAdvancedOptions,
  ImageAdvancedOptions,
  VideoAdvancedOptions,
  AudioAdvancedOptions,
  DEFAULT_TEXT_OPTIONS,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_VIDEO_OPTIONS,
  DEFAULT_AUDIO_OPTIONS,
} from '../../types'

// ─── Constants ────────────────────────────────────────────────────────────────
const CONTENT_TYPES: Array<{
  type: ContentType
  label: string
  icon: React.ReactNode
  description: string
  color: string
}> = [
  {
    type: 'text',
    label: 'Text / Copy',
    icon: <FileTextIcon size={20} />,
    description: 'Blog posts, captions, ad copy, threads',
    color: 'from-blue-500 to-indigo-500',
  },
  {
    type: 'image',
    label: 'Image',
    icon: <ImageIcon size={20} />,
    description: 'AI-generated images via DALL-E 3',
    color: 'from-pink-500 to-rose-500',
  },
  {
    type: 'video',
    label: 'Video Script',
    icon: <VideoIcon size={20} />,
    description: 'Structured scripts with scene breakdowns',
    color: 'from-orange-500 to-amber-500',
  },
  {
    type: 'audio',
    label: 'Audio / TTS',
    icon: <MicIcon size={20} />,
    description: 'Text-to-speech via ElevenLabs',
    color: 'from-purple-500 to-violet-500',
  },
]

const TONES = [
  'Professional',
  'Casual',
  'Humorous',
  'Inspirational',
  'Formal',
  'Conversational',
]

interface VoiceOption {
  voice_id: string
  name: string
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadFromStorage<T>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaults
    return JSON.parse(raw) as T
  } catch {
    return defaults
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // SecurityError or quota exceeded — silently ignore
  }
}

// ─── Shared field styles ──────────────────────────────────────────────────────
const fieldClass =
  'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] transition-all'

const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

// ─── ContentHub ───────────────────────────────────────────────────────────────
export const ContentHub: React.FC = () => {
  const { user, activeTeam } = useAppContext()

  const [selectedType, setSelectedType] = useState<ContentType>('text')
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('Professional')
  const [useBrandVoice, setUseBrandVoice] = useState(false)
  const [pricing, setPricing] = useState<PricingConfig[]>([])
  const [pricingUnavailable, setPricingUnavailable] = useState(false)
  const [activeJob, setActiveJob] = useState<ContentJob | null>(null)
  const [recentJobs, setRecentJobs] = useState<ContentJob[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showToneDropdown, setShowToneDropdown] = useState(false)

  // ─── Advanced options state ──────────────────────────────────────────────────
  const [textOptions, setTextOptions] = useState<TextAdvancedOptions>(DEFAULT_TEXT_OPTIONS)
  const [imageOptions, setImageOptions] = useState<ImageAdvancedOptions>(DEFAULT_IMAGE_OPTIONS)
  const [videoOptions, setVideoOptions] = useState<VideoAdvancedOptions>(DEFAULT_VIDEO_OPTIONS)
  const [audioOptions, setAudioOptions] = useState<AudioAdvancedOptions>(DEFAULT_AUDIO_OPTIONS)

  // Collapsible panel open/closed per content type
  const [advancedOpen, setAdvancedOpen] = useState<Record<ContentType, boolean>>({
    text: false,
    image: false,
    video: false,
    audio: false,
  })

  // Audio voice list
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voicesFailed, setVoicesFailed] = useState(false)

  // Track whether we've done the initial localStorage restore
  const restoredRef = useRef(false)

  // ─── Task 12.5 — Brand voice on mount ────────────────────────────────────────
  useEffect(() => {
    if (!activeTeam) return
    const fetchBrandProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('brand_profiles')
          .select('voice_guidelines')
          .eq('team_id', activeTeam.id)
          .maybeSingle()
        if (error) throw error
        const hasGuidelines = data?.voice_guidelines != null
        setUseBrandVoice(hasGuidelines)
        setTextOptions((prev) => ({ ...prev, brandVoiceEnabled: hasGuidelines }))
        setVideoOptions((prev) => ({ ...prev, brandVoiceEnabled: hasGuidelines }))
      } catch (error: unknown) {
        reportError('ContentHub.fetchBrandProfile [ContentHub.tsx]', error)
        setUseBrandVoice(false)
      }
    }
    void fetchBrandProfile()
  }, [activeTeam])

  // ─── Task 12.6 — Restore advanced options from localStorage on mount ─────────
  useEffect(() => {
    if (!activeTeam || restoredRef.current) return
    restoredRef.current = true
    const teamId = activeTeam.id
    setTextOptions(loadFromStorage<TextAdvancedOptions>(`${teamId}:text:advancedOptions`, DEFAULT_TEXT_OPTIONS))
    setImageOptions(loadFromStorage<ImageAdvancedOptions>(`${teamId}:image:advancedOptions`, DEFAULT_IMAGE_OPTIONS))
    setVideoOptions(loadFromStorage<VideoAdvancedOptions>(`${teamId}:video:advancedOptions`, DEFAULT_VIDEO_OPTIONS))
    setAudioOptions(loadFromStorage<AudioAdvancedOptions>(`${teamId}:audio:advancedOptions`, DEFAULT_AUDIO_OPTIONS))
  }, [activeTeam])

  // ─── Task 12.6 — Persist advanced options to localStorage on every change ────
  useEffect(() => {
    if (!activeTeam) return
    saveToStorage(`${activeTeam.id}:text:advancedOptions`, textOptions)
  }, [textOptions, activeTeam])

  useEffect(() => {
    if (!activeTeam) return
    saveToStorage(`${activeTeam.id}:image:advancedOptions`, imageOptions)
  }, [imageOptions, activeTeam])

  useEffect(() => {
    if (!activeTeam) return
    saveToStorage(`${activeTeam.id}:video:advancedOptions`, videoOptions)
  }, [videoOptions, activeTeam])

  useEffect(() => {
    if (!activeTeam) return
    saveToStorage(`${activeTeam.id}:audio:advancedOptions`, audioOptions)
  }, [audioOptions, activeTeam])

  // ─── Task 13.1 — Load pricing on mount and when advanced options change ───────
  useEffect(() => {
    const loadPricing = async () => {
      const result = await getPricingConfig()
      if (result.length === 0) {
        setPricingUnavailable(true)
        setPricing([])
      } else {
        setPricingUnavailable(false)
        setPricing(result)
      }
    }
    void loadPricing()
  }, [textOptions, imageOptions, videoOptions, audioOptions])

  // Load recent jobs on mount
  useEffect(() => {
    if (user) {
      void getRecentJobs(user.id).then(setRecentJobs)
    }
  }, [user])

  // ─── Audio voice fetch ────────────────────────────────────────────────────────
  const fetchVoices = useCallback(async () => {
    setVoicesLoading(true)
    setVoicesFailed(false)
    try {
      const { data, error } = await supabase.functions.invoke<{ voices: VoiceOption[] }>('list-voices', {
        body: { provider: audioOptions.provider },
      })
      if (error || !data?.voices) throw new Error('Failed to fetch voices')
      setVoices(data.voices)
    } catch (error: unknown) {
      reportError('ContentHub.fetchVoices [ContentHub.tsx]', error)
      setVoicesFailed(true)
      setVoices([])
    } finally {
      setVoicesLoading(false)
    }
  }, [audioOptions.provider])

  useEffect(() => {
    if (selectedType === 'audio') {
      void fetchVoices()
    }
  }, [selectedType, fetchVoices])

  // Subscribe to active job updates via Realtime
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') {
      return
    }
    const unsubscribe = subscribeToJob(activeJob.id, (updated) => {
      setActiveJob(updated)
      if (updated.status === 'completed') {
        setIsGenerating(false)
        toast.success('Content generated successfully!')
        if (user) void getRecentJobs(user.id).then(setRecentJobs)
      } else if (updated.status === 'failed') {
        setIsGenerating(false)
        toast.error(updated.error_message ?? 'Generation failed. Please try again.')
      }
    })
    return unsubscribe
  }, [activeJob, user])

  // ─── Task 13.2 — Credit cost for selected type ───────────────────────────────
  const creditCost = pricing.find((p) => p.content_type === selectedType)?.credits_cost ?? 0

  // ─── Task 14.1 — Build metadata from advanced options (currently unused) ───────

  const handleGenerate = useCallback(async () => {
    if (!user || !prompt.trim()) return
    if (isGenerating) return
    setIsGenerating(true)
    setActiveJob(null)
    try {
      const job = await createContentJob(user.id, {
        type:       selectedType,
        prompt:     prompt.trim(),
        tone:       tone.toLowerCase(),
        teamId:     activeTeam?.id,
        brandVoice: useBrandVoice
          ? 'Use the brand voice guidelines from the team profile.'
          : undefined,
      })
      setActiveJob(job)
    } catch (err: unknown) {
      setIsGenerating(false)
      toast.error(err instanceof Error ? err.message : 'Failed to start generation')
    }
  }, [user, prompt, selectedType, tone, useBrandVoice, isGenerating, activeTeam])

  const handleCancel = useCallback(async () => {
    if (!activeJob || !user) return
    await cancelJob(activeJob.id, user.id)
    setIsGenerating(false)
    setActiveJob(null)
    toast.info('Generation cancelled')
  }, [activeJob, user])

  // ─── Advanced options toggle ──────────────────────────────────────────────────
  const toggleAdvanced = (type: ContentType) => {
    setAdvancedOpen((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-enhanced rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Content Hub
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Generate AI-powered content for any platform
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Generator form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Content type selector */}
          <div className="glass-enhanced rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Content Type
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.type}
                  onClick={() => setSelectedType(ct.type)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    selectedType === ct.type
                      ? 'border-[#3FE0A5] bg-[#3FE0A5]/10'
                      : 'border-transparent glass-light hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ct.color} flex items-center justify-center text-white`}
                  >
                    {ct.icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center">
                    {ct.label}
                  </span>
                  <span className="text-xs text-[#3FE0A5] font-medium">
                    {pricing.find((p) => p.content_type === ct.type)?.credits_cost ?? '?'} credits
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt input + tone + advanced options */}
          <div className="glass-enhanced rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  selectedType === 'text'
                    ? 'Write a LinkedIn post about the benefits of remote work...'
                    : selectedType === 'image'
                    ? 'A professional headshot of a business person in a modern office...'
                    : selectedType === 'video'
                    ? 'Create a 60-second product demo script for a SaaS tool...'
                    : 'Read this text in a warm, professional tone: Hello and welcome...'
                }
                rows={5}
                className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 resize-none transition-all focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] text-sm"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {prompt.length} characters
              </p>
            </div>

            {/* Tone selector */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowToneDropdown(!showToneDropdown)}
                  className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors"
                >
                  Tone: {tone}
                  <ChevronDownIcon size={14} />
                </button>
                {showToneDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 glass rounded-xl shadow-xl border border-white/10 dark:border-gray-700/30 z-10 overflow-hidden">
                    {TONES.map((t) => (
                      <button
                        key={t}
                        onClick={() => { setTone(t); setShowToneDropdown(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          tone === t
                            ? 'text-[#3FE0A5] bg-[#3FE0A5]/10'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-white/5'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useBrandVoice}
                  onChange={(e) => setUseBrandVoice(e.target.checked)}
                  className="h-4 w-4 text-[#3FE0A5] focus:ring-[#3FE0A5] border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Use brand voice
                </span>
              </label>
            </div>

            {/* ── Task 12.1 — Text Advanced Options ── */}
            {selectedType === 'text' && (
              <div className="border border-gray-200/50 dark:border-gray-700/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleAdvanced('text')}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  aria-expanded={advancedOpen.text}
                >
                  Advanced options
                  <ChevronDownIcon
                    size={16}
                    className={`transition-transform ${advancedOpen.text ? 'rotate-180' : ''}`}
                  />
                </button>
                {advancedOpen.text && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-4 border-t border-gray-200/50 dark:border-gray-700/30 pt-4">
                    {/* AI Model */}
                    <div>
                      <label className={labelClass}>AI Model</label>
                      <select
                        value={textOptions.model}
                        onChange={(e) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            model: e.target.value as TextAdvancedOptions['model'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o mini</option>
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </select>
                    </div>
                    {/* Tone */}
                    <div>
                      <label className={labelClass}>Tone</label>
                      <select
                        value={textOptions.tone}
                        onChange={(e) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            tone: e.target.value as TextAdvancedOptions['tone'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="humorous">Humorous</option>
                        <option value="persuasive">Persuasive</option>
                        <option value="informative">Informative</option>
                      </select>
                    </div>
                    {/* Output Format */}
                    <div>
                      <label className={labelClass}>Output Format</label>
                      <select
                        value={textOptions.outputFormat}
                        onChange={(e) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            outputFormat: e.target.value as TextAdvancedOptions['outputFormat'],
                          }))
                        }
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
                      <label className={labelClass}>Language</label>
                      <input
                        type="text"
                        value={textOptions.language}
                        onChange={(e) =>
                          setTextOptions((prev) => ({ ...prev, language: e.target.value }))
                        }
                        placeholder="en"
                        className={fieldClass}
                      />
                    </div>
                    {/* Word Count Min */}
                    <div>
                      <label className={labelClass}>Min Words (1–10000)</label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={textOptions.wordCountMin}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(10000, Number(e.target.value)))
                          setTextOptions((prev) => ({ ...prev, wordCountMin: val }))
                        }}
                        className={fieldClass}
                      />
                    </div>
                    {/* Word Count Max */}
                    <div>
                      <label className={labelClass}>Max Words (≥ min)</label>
                      <input
                        type="number"
                        min={textOptions.wordCountMin}
                        max={10000}
                        value={textOptions.wordCountMax}
                        onChange={(e) => {
                          const val = Math.max(textOptions.wordCountMin, Math.min(10000, Number(e.target.value)))
                          setTextOptions((prev) => ({ ...prev, wordCountMax: val }))
                        }}
                        className={fieldClass}
                      />
                    </div>
                    {/* Brand Voice Toggle */}
                    <div className="col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={textOptions.brandVoiceEnabled}
                          onChange={(e) =>
                            setTextOptions((prev) => ({
                              ...prev,
                              brandVoiceEnabled: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 text-[#3FE0A5] focus:ring-[#3FE0A5] border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Use brand voice guidelines
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Task 12.2 — Image Advanced Options ── */}
            {selectedType === 'image' && (
              <div className="border border-gray-200/50 dark:border-gray-700/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleAdvanced('image')}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  aria-expanded={advancedOpen.image}
                >
                  Advanced options
                  <ChevronDownIcon
                    size={16}
                    className={`transition-transform ${advancedOpen.image ? 'rotate-180' : ''}`}
                  />
                </button>
                {advancedOpen.image && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-4 border-t border-gray-200/50 dark:border-gray-700/30 pt-4">
                    {/* Provider */}
                    <div>
                      <label className={labelClass}>Provider</label>
                      <select
                        value={imageOptions.provider}
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            provider: e.target.value as ImageAdvancedOptions['provider'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="dall-e-3">DALL-E 3</option>
                        <option value="stable-diffusion">Stable Diffusion</option>
                      </select>
                    </div>
                    {/* Resolution */}
                    <div>
                      <label className={labelClass}>Resolution</label>
                      <select
                        value={imageOptions.resolution}
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            resolution: e.target.value as ImageAdvancedOptions['resolution'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="512x512">512×512</option>
                        <option value="1024x1024">1024×1024</option>
                        <option value="1792x1024">1792×1024</option>
                        <option value="1024x1792">1024×1792</option>
                      </select>
                    </div>
                    {/* Style */}
                    <div>
                      <label className={labelClass}>Style</label>
                      <select
                        value={imageOptions.style}
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            style: e.target.value as ImageAdvancedOptions['style'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="photorealistic">Photorealistic</option>
                        <option value="illustration">Illustration</option>
                        <option value="digital_art">Digital Art</option>
                        <option value="oil_painting">Oil Painting</option>
                        <option value="watercolor">Watercolor</option>
                      </select>
                    </div>
                    {/* Num Images */}
                    <div>
                      <label className={labelClass}>Number of Images (1–4)</label>
                      <input
                        type="number"
                        min={1}
                        max={4}
                        value={imageOptions.numImages}
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            numImages: Math.max(1, Math.min(4, Number(e.target.value))),
                          }))
                        }
                        className={fieldClass}
                      />
                    </div>
                    {/* Seed */}
                    <div>
                      <label className={labelClass}>Seed (0–2147483647)</label>
                      <input
                        type="number"
                        min={0}
                        max={2147483647}
                        value={imageOptions.seed}
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            seed: Math.max(0, Math.min(2147483647, Number(e.target.value))),
                          }))
                        }
                        className={fieldClass}
                      />
                    </div>
                    {/* Negative Prompt */}
                    <div className="col-span-2">
                      <label className={labelClass}>Negative Prompt (max 500 chars)</label>
                      <textarea
                        value={imageOptions.negativePrompt}
                        maxLength={500}
                        rows={2}
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            negativePrompt: e.target.value.slice(0, 500),
                          }))
                        }
                        placeholder="Things to avoid in the image..."
                        className={fieldClass + ' resize-none'}
                      />
                      <p className="text-xs text-gray-400 text-right mt-0.5">
                        {imageOptions.negativePrompt.length}/500
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Task 12.3 — Video Advanced Options ── */}
            {selectedType === 'video' && (
              <div className="border border-gray-200/50 dark:border-gray-700/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleAdvanced('video')}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  aria-expanded={advancedOpen.video}
                >
                  Advanced options
                  <ChevronDownIcon
                    size={16}
                    className={`transition-transform ${advancedOpen.video ? 'rotate-180' : ''}`}
                  />
                </button>
                {advancedOpen.video && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-4 border-t border-gray-200/50 dark:border-gray-700/30 pt-4">
                    {/* Video Model */}
                    <div className="col-span-2">
                      <label className={labelClass}>Video Model</label>
                      <select
                        value={videoOptions.model}
                        onChange={(e) =>
                          setVideoOptions((prev) => ({
                            ...prev,
                            model: e.target.value as VideoAdvancedOptions['model'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <optgroup label="KlingAI">
                          <option value="klingai/kling-v2.6-t2v">Kling v2.6 — audio support</option>
                          <option value="klingai/kling-v3.0-t2v">Kling v3.0 — multi-shot, 15s</option>
                        </optgroup>
                        <optgroup label="Alibaba">
                          <option value="alibaba/wan-v2.6-t2v">Wan v2.6 — native audio</option>
                        </optgroup>
                        <optgroup label="Google">
                          <option value="google/veo-3.1-generate-001">Veo 3.1 — cinematic quality</option>
                        </optgroup>
                        <optgroup label="xAI">
                          <option value="xai/grok-imagine-video">Grok Imagine — fast, 1–15s</option>
                        </optgroup>
                        <optgroup label="ByteDance">
                          <option value="bytedance/seedance-v1.5-pro">Seedance v1.5 Pro — audio sync</option>
                        </optgroup>
                      </select>
                    </div>
                    {/* Aspect Ratio */}
                    <div>
                      <label className={labelClass}>Aspect Ratio</label>
                      <select
                        value={videoOptions.aspectRatio}
                        onChange={(e) =>
                          setVideoOptions((prev) => ({
                            ...prev,
                            aspectRatio: e.target.value as VideoAdvancedOptions['aspectRatio'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="1:1">1:1 (Square)</option>
                      </select>
                    </div>
                    {/* Duration */}
                    <div>
                      <label className={labelClass}>Duration</label>
                      <select
                        value={videoOptions.duration}
                        onChange={(e) =>
                          setVideoOptions((prev) => ({
                            ...prev,
                            duration: Number(e.target.value) as VideoAdvancedOptions['duration'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value={5}>5 seconds</option>
                        <option value={8}>8 seconds</option>
                        <option value={10}>10 seconds</option>
                        <option value={15}>15 seconds</option>
                      </select>
                    </div>
                    {/* Mode */}
                    <div>
                      <label className={labelClass}>Mode</label>
                      <select
                        value={videoOptions.mode}
                        onChange={(e) =>
                          setVideoOptions((prev) => ({
                            ...prev,
                            mode: e.target.value as VideoAdvancedOptions['mode'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="std">Standard</option>
                        <option value="pro">Pro</option>
                      </select>
                    </div>
                    {/* Generate Audio Toggle */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer mt-4">
                        <input
                          type="checkbox"
                          checked={videoOptions.generateAudio}
                          onChange={(e) =>
                            setVideoOptions((prev) => ({
                              ...prev,
                              generateAudio: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 text-[#3FE0A5] focus:ring-[#3FE0A5] border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Generate audio
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Task 12.4 — Audio Advanced Options ── */}
            {selectedType === 'audio' && (
              <div className="border border-gray-200/50 dark:border-gray-700/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleAdvanced('audio')}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  aria-expanded={advancedOpen.audio}
                >
                  Advanced options
                  <ChevronDownIcon
                    size={16}
                    className={`transition-transform ${advancedOpen.audio ? 'rotate-180' : ''}`}
                  />
                </button>
                {advancedOpen.audio && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-4 border-t border-gray-200/50 dark:border-gray-700/30 pt-4">
                    {/* Provider */}
                    <div>
                      <label className={labelClass}>TTS Provider</label>
                      <select
                        value={audioOptions.provider}
                        onChange={(e) =>
                          setAudioOptions((prev) => ({
                            ...prev,
                            provider: e.target.value as AudioAdvancedOptions['provider'],
                          }))
                        }
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
                          <Loader2Icon size={12} className="animate-spin" />
                          Loading voices…
                        </div>
                      ) : (
                        <>
                          <select
                            value={audioOptions.voiceId}
                            onChange={(e) =>
                              setAudioOptions((prev) => ({ ...prev, voiceId: e.target.value }))
                            }
                            disabled={voicesFailed || voices.length === 0}
                            className={`${fieldClass} ${voicesFailed ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {voicesFailed ? (
                              <option value="">Failed to load voices</option>
                            ) : voices.length === 0 ? (
                              <option value="">No voices available</option>
                            ) : (
                              voices.map((v) => (
                                <option key={v.voice_id} value={v.voice_id}>
                                  {v.name}
                                </option>
                              ))
                            )}
                          </select>
                          {voicesFailed && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs text-red-500">Failed to load voices</span>
                              <button
                                onClick={() => void fetchVoices()}
                                className="flex items-center gap-1 text-xs text-[#3FE0A5] hover:underline"
                              >
                                <RefreshCwIcon size={12} />
                                Retry
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {/* Speaking Rate */}
                    <div className="col-span-2">
                      <label className={labelClass}>
                        Speaking Rate: {audioOptions.speakingRate.toFixed(1)}×
                      </label>
                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={audioOptions.speakingRate}
                        onChange={(e) =>
                          setAudioOptions((prev) => ({
                            ...prev,
                            speakingRate: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#3FE0A5]"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                        <span>0.5×</span><span>2.0×</span>
                      </div>
                    </div>
                    {/* Pitch Adjustment */}
                    <div className="col-span-2">
                      <label className={labelClass}>
                        Pitch Adjustment: {audioOptions.pitchAdjustment > 0 ? '+' : ''}{audioOptions.pitchAdjustment} semitones
                      </label>
                      <input
                        type="range"
                        min={-10}
                        max={10}
                        step={1}
                        value={audioOptions.pitchAdjustment}
                        onChange={(e) =>
                          setAudioOptions((prev) => ({
                            ...prev,
                            pitchAdjustment: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#3FE0A5]"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                        <span>-10</span><span>+10</span>
                      </div>
                    </div>
                    {/* Output Format */}
                    <div>
                      <label className={labelClass}>Output Format</label>
                      <select
                        value={audioOptions.outputFormat}
                        onChange={(e) =>
                          setAudioOptions((prev) => ({
                            ...prev,
                            outputFormat: e.target.value as AudioAdvancedOptions['outputFormat'],
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="mp3">MP3</option>
                        <option value="wav">WAV</option>
                      </select>
                    </div>
                    {/* Stability/Clarity — ElevenLabs only */}
                    {audioOptions.provider === 'elevenlabs' && (
                      <div className="col-span-2">
                        <label className={labelClass}>
                          Stability / Clarity: {audioOptions.stabilityClarity}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={audioOptions.stabilityClarity}
                          onChange={(e) =>
                            setAudioOptions((prev) => ({
                              ...prev,
                              stabilityClarity: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#3FE0A5]"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                          <span>0</span><span>100</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Task 13.2/13.3 — Credit cost + Generate button ── */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200/50 dark:border-gray-700/30">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {pricingUnavailable ? (
                  <span className="font-medium text-amber-500">Cost estimate unavailable</span>
                ) : (
                  <>
                    Cost:{' '}
                    <span className="font-semibold text-[#3FE0A5]">
                      {creditCost} credits
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {isGenerating && (
                  <button
                    onClick={() => void handleCancel()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 glass-light rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <XCircleIcon size={16} />
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating || !prompt.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl shadow-lg shadow-[#3FE0A5]/20 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2Icon size={18} className="animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <SparklesIcon size={18} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Active job result */}
          {activeJob && (
            <div className="glass-enhanced rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Result
                </h2>
                <StatusBadge status={activeJob.status} />
              </div>

              {activeJob.status === 'running' || activeJob.status === 'pending' ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-12 h-12 rounded-full border-4 border-[#3FE0A5]/30 border-t-[#3FE0A5] animate-spin" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activeJob.status === 'pending'
                      ? 'Queuing your request…'
                      : 'Generating content…'}
                  </p>
                </div>
              ) : activeJob.status === 'failed' ? (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <AlertCircleIcon size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      Generation failed
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {activeJob.error_message ?? 'An unexpected error occurred.'}
                    </p>
                  </div>
                </div>
              ) : (
                <TextResultViewer job={activeJob} />
              )}
            </div>
          )}
        </div>

        {/* Right: Recent jobs */}
        <div className="glass-enhanced rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
            Recent Generations
          </h2>
          {recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <FolderIcon size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No generations yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => {
                const ct = CONTENT_TYPES.find((c) => c.type === job.type)
                return (
                  <button
                    key={job.id}
                    onClick={() => setActiveJob(job)}
                    className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${ct?.color ?? 'from-gray-400 to-gray-500'} flex items-center justify-center text-white flex-shrink-0`}
                    >
                      {ct?.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                        {job.prompt.length > 50
                          ? `${job.prompt.slice(0, 50)}…`
                          : job.prompt}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={job.status} />
                        <span className="text-xs text-gray-400">
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

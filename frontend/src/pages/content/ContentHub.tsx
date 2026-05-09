import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  SparklesIcon,
  XCircleIcon,
  CopyIcon,
  DownloadIcon,
  FolderIcon,
  CheckIcon,
  AlertCircleIcon,
  Loader2Icon,
  ChevronDownIcon,
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import {
  createContentJob,
  subscribeToJob,
  cancelJob,
  getPricingConfig,
  getRecentJobs,
} from '../../services/contentService'
import type { ContentJob, ContentType, PricingConfig } from '../../types'

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

// ─── Job Status Badge ─────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: ContentJob['status'] }> = ({ status }) => {
  const styles: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    running:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? ''}`}>
      {status}
    </span>
  )
}

// ─── Result Viewer ────────────────────────────────────────────────────────────
const ResultViewer: React.FC<{ job: ContentJob }> = ({ job }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!job.result_url) return
    try {
      const res = await fetch(job.result_url)
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  if (job.type === 'image' && job.result_url) {
    return (
      <div className="space-y-3">
        <img
          src={job.result_url}
          alt="Generated image"
          className="w-full rounded-xl object-cover max-h-96"
        />
        <div className="flex gap-2">
          <a
            href={job.result_url}
            download
            className="flex items-center gap-2 px-4 py-2 glass-enhanced rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white/50 transition-colors"
          >
            <DownloadIcon size={16} />
            Download
          </a>
        </div>
      </div>
    )
  }

  if (job.type === 'audio' && job.result_url) {
    return (
      <div className="space-y-3">
        <audio controls className="w-full" src={job.result_url}>
          Your browser does not support audio playback.
        </audio>
        <a
          href={job.result_url}
          download
          className="inline-flex items-center gap-2 px-4 py-2 glass-enhanced rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white/50 transition-colors"
        >
          <DownloadIcon size={16} />
          Download MP3
        </a>
      </div>
    )
  }

  // Text / video script
  return (
    <div className="space-y-3">
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 max-h-64 overflow-y-auto">
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {job.result_url ? (
            <a
              href={job.result_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3FE0A5] hover:underline"
            >
              View generated content ↗
            </a>
          ) : (
            'Content generated successfully.'
          )}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => void handleCopy()}
          className="flex items-center gap-2 px-4 py-2 glass-enhanced rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white/50 transition-colors"
        >
          {copied ? <CheckIcon size={16} className="text-green-500" /> : <CopyIcon size={16} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {job.result_url && (
          <a
            href={job.result_url}
            download
            className="flex items-center gap-2 px-4 py-2 glass-enhanced rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white/50 transition-colors"
          >
            <DownloadIcon size={16} />
            Download
          </a>
        )}
      </div>
    </div>
  )
}

// ─── ContentHub ───────────────────────────────────────────────────────────────
export const ContentHub: React.FC = () => {
  const { user } = useAppContext()

  const [selectedType, setSelectedType] = useState<ContentType>('text')
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('Professional')
  const [useBrandVoice, setUseBrandVoice] = useState(false)
  const [pricing, setPricing] = useState<PricingConfig[]>([])
  const [activeJob, setActiveJob] = useState<ContentJob | null>(null)
  const [recentJobs, setRecentJobs] = useState<ContentJob[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showToneDropdown, setShowToneDropdown] = useState(false)

  // Load pricing and recent jobs on mount
  useEffect(() => {
    void getPricingConfig().then(setPricing)
    if (user) {
      void getRecentJobs(user.id).then(setRecentJobs)
    }
  }, [user])

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
        // Refresh recent jobs
        if (user) void getRecentJobs(user.id).then(setRecentJobs)
      } else if (updated.status === 'failed') {
        setIsGenerating(false)
        toast.error(updated.error_message ?? 'Generation failed. Please try again.')
      }
    })

    return unsubscribe
  }, [activeJob?.id, activeJob?.status, user])

  const creditCost = pricing.find((p) => p.content_type === selectedType)?.credits_cost ?? 0

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
        brandVoice: useBrandVoice ? 'Use the brand voice guidelines from the user profile.' : undefined,
      })
      setActiveJob(job)
    } catch (err: unknown) {
      setIsGenerating(false)
      toast.error(err instanceof Error ? err.message : 'Failed to start generation')
    }
  }, [user, prompt, selectedType, tone, useBrandVoice, isGenerating])

  const handleCancel = useCallback(async () => {
    if (!activeJob || !user) return
    await cancelJob(activeJob.id, user.id)
    setIsGenerating(false)
    setActiveJob(null)
    toast.info('Generation cancelled')
  }, [activeJob, user])

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
                    {creditCost > 0 && selectedType === ct.type
                      ? `${pricing.find((p) => p.content_type === ct.type)?.credits_cost ?? '?'} credits`
                      : `${pricing.find((p) => p.content_type === ct.type)?.credits_cost ?? '?'} credits`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt input */}
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

            {/* Credit cost + Generate button */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200/50 dark:border-gray-700/30">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Cost:{' '}
                <span className="font-semibold text-[#3FE0A5]">
                  {creditCost} credits
                </span>
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
                <ResultViewer job={activeJob} />
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

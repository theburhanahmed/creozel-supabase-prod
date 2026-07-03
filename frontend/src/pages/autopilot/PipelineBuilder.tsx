import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeftIcon, WorkflowIcon, FileTextIcon, ShareIcon,
  SaveIcon, DownloadIcon, SparklesIcon, GlobeIcon, Loader2Icon, CheckIcon,
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { CONTENT_FORMAT_REGISTRY } from '../../constants/contentFormatRegistry'
import {
  checkPipelineNameExists,
  createPipeline,
  defaultPipelineConfig,
  describeSchedule,
  generateN8nWorkflow,
  getPipeline,
  getPipelines,
  updatePipeline,
  type SavePipelineInput,
} from '../../services/pipelineService'
import { reportError } from '../../utils/errorReporter'
import type { ContentCategory, ContentFormat, Pipeline, PipelineConfig, SocialPlatform, StudioTone } from '../../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: ContentCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Text', icon: <FileTextIcon size={16} /> },
  { value: 'image', label: 'Image', icon: <SparklesIcon size={16} /> },
  { value: 'video', label: 'Video', icon: <ShareIcon size={16} /> },
  { value: 'audio', label: 'Audio', icon: <WorkflowIcon size={16} /> },
]

const TONES: { value: StudioTone; label: string }[] = [
  { value: 'Professional', label: 'Professional' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Humorous', label: 'Humorous' },
  { value: 'Inspirational', label: 'Inspirational' },
  { value: 'Persuasive', label: 'Persuasive' },
  { value: 'Informative', label: 'Informative' },
]

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
]

const SCHEDULE_PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'Manual / no schedule' },
  { value: '0 9 * * 1', label: 'Monday 9:00 AM' },
  { value: '0 9 * * *', label: 'Daily 9:00 AM' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 * * * *', label: 'Every hour' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function useFormatOptions(category: ContentCategory): { value: ContentFormat; label: string }[] {
  return useMemo(() => {
    const formats = Object.keys(CONTENT_FORMAT_REGISTRY) as ContentFormat[]
    return formats
      .filter((f) => CONTENT_FORMAT_REGISTRY[f].category === category)
      .map((f) => ({ value: f, label: CONTENT_FORMAT_REGISTRY[f].label }))
  }, [category])
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const PipelineBuilder: React.FC = () => {
  const { user, activeTeam } = useAppContext()
  const navigate = useNavigate()
  const { pipelineId } = useParams<{ pipelineId?: string }>()
  const teamId = activeTeam?.id

  const nameId = useId()
  const descId = useId()
  const scheduleId = useId()
  const promptId = useId()

  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [schedule, setSchedule] = useState('')
  const [config, setConfig] = useState<PipelineConfig>(defaultPipelineConfig())
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([])
  const [showJson, setShowJson] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const formatOptions = useFormatOptions(config.contentCategory)

  // Load existing pipelines and optionally the selected pipeline
  useEffect(() => {
    if (!teamId) return
    void (async () => {
      setIsLoading(true)
      const list = await getPipelines(teamId)
      setPipelines(list)

      if (pipelineId) {
        const existing = await getPipeline(pipelineId, teamId)
        if (existing && existing.team_id === teamId) {
          setName(existing.name)
          setDescription(existing.description)
          setSchedule(existing.schedule ?? '')
          setConfig(existing.config)
          setSelectedPlatforms(existing.config.platforms ?? [])
        } else {
          toast.error('Pipeline not found or not available for this team.')
        }
      }
      setIsLoading(false)
    })()
  }, [teamId, pipelineId])

  const handleCategoryChange = useCallback((category: ContentCategory) => {
    setConfig((prev) => {
      const formats = Object.keys(CONTENT_FORMAT_REGISTRY) as ContentFormat[]
      const firstFormat = formats.find((f) => CONTENT_FORMAT_REGISTRY[f].category === category) ?? prev.contentFormat
      return { ...prev, contentCategory: category, contentFormat: firstFormat }
    })
  }, [])

  const handleFormatChange = useCallback((format: ContentFormat) => {
    setConfig((prev) => ({ ...prev, contentFormat: format }))
  }, [])

  const handleToneChange = useCallback((tone: StudioTone) => {
    setConfig((prev) => ({ ...prev, tone }))
  }, [])

  const togglePlatform = useCallback((platform: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    )
  }, [])

  const n8nWorkflow = useMemo(() => {
    if (!teamId) return null
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
    if (!supabaseUrl) return null
    const functionsUrl = `${supabaseUrl}/functions/v1`
    return generateN8nWorkflow(pipelineId ?? 'NEW_PIPELINE_ID', name || 'Untitled Pipeline', schedule || null, functionsUrl)
  }, [pipelineId, name, schedule, teamId])

  const exportJson = useCallback(() => {
    if (!n8nWorkflow) return
    const blob = new Blob([JSON.stringify(n8nWorkflow, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.trim() || 'creozel-pipeline'}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('n8n workflow JSON downloaded.')
  }, [n8nWorkflow, name])

  const validate = useCallback(async (): Promise<boolean> => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Pipeline name is required.')
      return false
    }
    if (trimmed.length > 100) {
      setNameError('Pipeline name must be 100 characters or fewer.')
      return false
    }
    if (!teamId) return false

    // Only check for duplicates when creating a new pipeline. When editing, the
    // name is allowed to remain unchanged.
    if (!pipelineId) {
      const exists = await checkPipelineNameExists(teamId, trimmed)
      if (exists) {
        setNameError('A pipeline with this name already exists.')
        return false
      }
    }

    setNameError(null)
    return true
  }, [name, teamId, pipelineId])

  const handleSave = useCallback(async () => {
    if (!teamId || !user) return
    const ok = await validate()
    if (!ok) return

    setIsSaving(true)
    const nextConfig: PipelineConfig = {
      ...config,
      promptTemplate: config.promptTemplate?.trim() || undefined,
      platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
      n8nWorkflow: n8nWorkflow ?? undefined,
    }

    const input: SavePipelineInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      schedule: schedule.trim() || null,
      config: nextConfig,
    }

    let result: Pipeline | null = null
    try {
      if (pipelineId) {
        result = await updatePipeline(pipelineId, teamId, input)
      } else {
        result = await createPipeline(teamId, input)
      }
    } catch (err) {
      reportError('PipelineBuilder.handleSave', err)
    }

    setIsSaving(false)
    if (result) {
      toast.success(pipelineId ? 'Pipeline updated.' : 'Pipeline created.')
      navigate(`/autopilot/builder/${result.id}`)
    } else {
      toast.error('Failed to save pipeline.')
    }
  }, [teamId, user, validate, config, selectedPlatforms, n8nWorkflow, name, description, schedule, pipelineId, navigate])

  if (!user || !teamId) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="glass-enhanced rounded-2xl p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Please sign in and select a team to build pipelines.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/autopilot" className="p-2 rounded-xl glass-light hover:glass transition-colors">
          <ArrowLeftIcon size={18} className="text-gray-600 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pipeline Builder</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Design an automation that generates and publishes content.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-enhanced rounded-2xl p-12 text-center">
          <Loader2Icon size={32} className="animate-spin text-[#3FE0A5] mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : (
        <>
          {/* Existing pipelines quick selector */}
          {!pipelineId && pipelines.length > 0 && (
            <div className="glass-enhanced rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Existing pipelines</h2>
              <div className="flex flex-wrap gap-2">
                {pipelines.map((p) => (
                  <Link
                    key={p.id}
                    to={`/autopilot/builder/${p.id}`}
                    className="px-3 py-1.5 rounded-lg glass-light text-xs font-medium text-gray-700 dark:text-gray-300 hover:glass"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Basic info */}
          <div className="glass-enhanced rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Pipeline details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor={nameId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id={nameId}
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(null) }}
                  placeholder="e.g. Weekly LinkedIn Article"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5]"
                />
                {nameError && <p className="text-xs text-red-500">{nameError}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor={scheduleId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Schedule
                </label>
                <select
                  id={scheduleId}
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5]"
                >
                  {SCHEDULE_PRESETS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {schedule && <p className="text-xs text-[#3FE0A5]">{describeSchedule(schedule)}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={descId} className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                id={descId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What does this pipeline do?"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5]"
              />
            </div>
          </div>

          {/* Content step */}
          <div className="glass-enhanced rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3FE0A5]/20 to-[#38B897]/10 flex items-center justify-center">
                <FileTextIcon size={16} className="text-[#3FE0A5]" />
              </div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Step 1: Generate content</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleCategoryChange(c.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    config.contentCategory === c.value
                      ? 'border-[#3FE0A5] bg-[#3FE0A5]/10 text-[#3FE0A5]'
                      : 'border-gray-200 dark:border-white/10 glass-light hover:glass text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Content format</label>
                <select
                  value={config.contentFormat}
                  onChange={(e) => handleFormatChange(e.target.value as ContentFormat)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5]"
                >
                  {formatOptions.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tone</label>
                <select
                  value={config.tone}
                  onChange={(e) => handleToneChange(e.target.value as StudioTone)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5]"
                >
                  {TONES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={promptId} className="text-sm font-medium text-gray-700 dark:text-gray-300">Prompt template</label>
              <textarea
                id={promptId}
                value={config.promptTemplate ?? ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, promptTemplate: e.target.value }))}
                rows={3}
                placeholder="Describe the content this pipeline should generate every time it runs."
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0A5]"
              />
            </div>
          </div>

          {/* Publish step */}
          <div className="glass-enhanced rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center">
                <GlobeIcon size={16} className="text-blue-500" />
              </div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Step 2: Publish to platforms</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const selected = selectedPlatforms.includes(p.value)
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePlatform(p.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-white/10 glass-light hover:glass text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {selected && <CheckIcon size={14} />}
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSaving ? <Loader2Icon size={16} className="animate-spin" /> : <SaveIcon size={16} />}
              {pipelineId ? 'Update Pipeline' : 'Save Pipeline'}
            </button>

            <button
              type="button"
              onClick={() => setShowJson((s) => !s)}
              className="flex items-center gap-2 px-4 py-2.5 glass-light text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:glass transition-colors"
            >
              <WorkflowIcon size={16} />
              {showJson ? 'Hide n8n JSON' : 'Preview n8n JSON'}
            </button>

            <button
              type="button"
              onClick={exportJson}
              disabled={!n8nWorkflow}
              className="flex items-center gap-2 px-4 py-2.5 glass-light text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:glass transition-colors disabled:opacity-50"
            >
              <DownloadIcon size={16} />
              Export .json
            </button>
          </div>

          {/* JSON preview */}
          {showJson && n8nWorkflow && (
            <div className="glass-enhanced rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Generated n8n workflow</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Import this JSON into n8n and configure an HTTP Header Auth credential with your Supabase anon/service-role key.
              </p>
              <pre className="bg-gray-900 text-gray-100 text-xs p-4 rounded-xl overflow-auto max-h-96">
                {JSON.stringify(n8nWorkflow, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}

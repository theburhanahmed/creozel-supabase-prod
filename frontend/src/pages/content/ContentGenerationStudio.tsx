import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { useStudioState } from '../../hooks/useStudioState'
import { useCreditEstimate } from '../../hooks/useCreditEstimate'
import { computeCanGenerate } from '../../components/content/studio/studioCanGenerate'
import { NoTeamEmptyState } from '../../components/content/studio/NoTeamEmptyState'
import { StudioHeader } from '../../components/content/studio/StudioHeader'
import { StudioLayout } from '../../components/content/studio/StudioLayout'
import { ConfigurationPanel } from '../../components/content/studio/ConfigurationPanel'
import { OutputPanel } from '../../components/content/studio/OutputPanel'
import { SaveAsPipelineModal } from '../../components/content/studio/SaveAsPipelineModal'
import { getWallet } from '../../services/creditsService'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../utils/errorReporter'

/**
 * ContentGenerationStudio
 *
 * The primary content creation page. Rendered at both `/content` and
 * `/content/studio` via the `<Route path="/content/*">` entry in App.tsx
 * (no redirect needed — both paths match the same route).
 *
 * Behaviour:
 * - Reads `user` and `activeTeam` from `useAppContext()`.
 * - When `activeTeam` is null, renders `NoTeamEmptyState` and does NOT
 *   render the Configuration Panel (Requirement 1.5).
 * - When `activeTeam` is set, renders `StudioHeader` with the team name,
 *   then `StudioLayout` containing `ConfigurationPanel` and `OutputPanel`.
 *
 * State is owned by `useStudioState(activeTeam?.id ?? null)`.
 *
 * Requirements: 1.1, 1.4, 1.5, 1.6, 9.1–9.7, 12.1–12.9
 */
export const ContentGenerationStudio: React.FC = () => {
  const { user, activeTeam } = useAppContext()

  // Master hook — owns all Studio form state and localStorage persistence.
  // Passing null when there is no active team is safe; the hook falls back
  // to in-memory defaults and skips localStorage reads/writes.
  const studio = useStudioState(activeTeam?.id ?? null)

  // ── Credit estimate (Requirement 9.1–9.7) ────────────────────────────────
  const {
    estimatedCost,
    isLoading: isCreditLoading,
    isUnavailable: isCreditUnavailable,
  } = useCreditEstimate(
    studio.contentCategory,
    studio.contentFormat,
    studio.buildMetadata().advancedOptions,
  )

  // ── Wallet balance (Requirement 9.4) ─────────────────────────────────────
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    void getWallet(user.id).then((wallet) => {
      if (!cancelled) setBalance(wallet?.balance ?? null)
    })
    return () => { cancelled = true }
  }, [user?.id])

  // ── Brand voice active (Requirement 5.4, 5.5) ────────────────────────────
  const [brandVoiceActive, setBrandVoiceActive] = useState(false)

  useEffect(() => {
    if (!activeTeam?.id) return
    let cancelled = false
    const fetchBrandVoice = async () => {
      try {
        const { data, error } = await supabase
          .from('brand_profiles')
          .select('voice_guidelines')
          .eq('team_id', activeTeam.id)
          .maybeSingle()
        if (cancelled) return
        if (error) {
          reportError('ContentGenerationStudio.fetchBrandVoice', error)
          setBrandVoiceActive(false)
          return
        }
        // brandVoiceActive is true only when voice_guidelines is non-null/non-empty
        const guidelines = (data as { voice_guidelines?: string | null } | null)?.voice_guidelines
        setBrandVoiceActive(typeof guidelines === 'string' && guidelines.trim().length > 0)
      } catch (err: unknown) {
        if (!cancelled) {
          reportError('ContentGenerationStudio.fetchBrandVoice', err)
          setBrandVoiceActive(false)
        }
      }
    }
    void fetchBrandVoice()
    return () => { cancelled = true }
  }, [activeTeam?.id])

  // ── canGenerate gate (Requirements 9.3, 9.5, 9.7, 2.4, 10.9) ────────────
  const canGenerate = computeCanGenerate({
    creditIsLoading: isCreditLoading,
    creditIsUnavailable: isCreditUnavailable,
    estimatedCost,
    balance,
    validationErrors: studio.validationErrors,
    prompt: studio.prompt,
  })

  // ── Save as Pipeline modal state (Requirement 12.1–12.9) ─────────────────
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false)
  const onSaveAsPipeline = () => setIsPipelineModalOpen(true)

  // ── Generate action stub (wired fully in task 15.3) ───────────────────────
  const isGenerating = studio.isGenerating
  const onGenerate = () => { /* task 15.3 */ }

  // onRegenerate resets the active job so the user can re-submit with the
  // same configuration (Requirement 11.10). Full wiring in task 15.3.
  const onRegenerate = () => {
    studio.setActiveJob(null)
    studio.setIsGenerating(false)
  }

  // ── No team — show empty state, do NOT render the configuration form ──────
  if (!activeTeam) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <StudioHeader teamName="No team selected" />
        <NoTeamEmptyState />
      </div>
    )
  }

  // ── Active team — render the full Studio ──────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header — displays team name (Requirement 1.4) */}
      <StudioHeader teamName={activeTeam.name} />

      {/* Two-panel responsive layout (Requirement 1.2, 1.3) */}
      <StudioLayout
        configPanel={
          <ConfigurationPanel
            // Identity
            teamId={activeTeam.id}
            userId={user?.id ?? ''}

            // Mode
            mode={studio.mode}
            setMode={studio.setMode}

            // Draft config
            prompt={studio.prompt}
            setPrompt={studio.setPrompt}
            contentCategory={studio.contentCategory}
            setContentCategory={studio.setContentCategory}
            contentFormat={studio.contentFormat}
            setContentFormat={studio.setContentFormat}
            platform={studio.platform}
            setPlatform={studio.setPlatform}
            tone={studio.tone}
            setTone={studio.setTone}
            length={studio.length}
            setLength={studio.setLength}

            // Advanced options
            textOptions={studio.textOptions}
            setTextOptions={studio.setTextOptions}
            imageOptions={studio.imageOptions}
            setImageOptions={studio.setImageOptions}
            videoOptions={studio.videoOptions}
            setVideoOptions={studio.setVideoOptions}
            audioOptions={studio.audioOptions}
            setAudioOptions={studio.setAudioOptions}

            // Repurposing
            repurposingSource={studio.repurposingSource}
            setRepurposingSource={studio.setRepurposingSource}
            repurposingTarget={studio.repurposingTarget}
            setRepurposingTarget={studio.setRepurposingTarget}
            repurposingInstructions={studio.repurposingInstructions}
            setRepurposingInstructions={studio.setRepurposingInstructions}

            // Validation
            validationErrors={studio.validationErrors}

            // Template
            applyTemplate={studio.applyTemplate}

            // Credit estimate (Requirement 9.1–9.7)
            estimatedCost={estimatedCost}
            balance={balance}
            isCreditLoading={isCreditLoading}
            isCreditUnavailable={isCreditUnavailable}

            // Actions
            canGenerate={canGenerate}
            isGenerating={isGenerating}
            onGenerate={onGenerate}
            onSaveAsPipeline={onSaveAsPipeline}

            // Brand voice (Requirement 5.4, 5.5)
            brandVoiceActive={brandVoiceActive}
          />
        }
        outputPanel={
          <OutputPanel
            activeJob={studio.activeJob}
            onRegenerate={onRegenerate}
          />
        }
      />

      {/* Save as Pipeline modal (Requirement 12.1–12.9) */}
      <SaveAsPipelineModal
        isOpen={isPipelineModalOpen}
        currentConfig={{
          prompt: studio.prompt,
          contentCategory: studio.contentCategory,
          contentFormat: studio.contentFormat,
          platform: studio.platform,
          tone: studio.tone,
          length: studio.length,
        }}
        teamId={activeTeam.id}
        onClose={() => setIsPipelineModalOpen(false)}
        onSaved={() => setIsPipelineModalOpen(false)}
      />
    </div>
  )
}

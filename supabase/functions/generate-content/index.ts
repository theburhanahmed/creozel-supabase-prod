/**
 * Edge Function: generate-content
 *
 * Invoked by the frontend after inserting a content_jobs row.
 * Calls the appropriate AI provider, uploads the result to Storage,
 * and updates the job row with the result URL.
 *
 * Request body:
 *   { job_id: string }
 *
 * The function reads the full job from the DB, calls the AI provider,
 * stores the result, and updates the job status.
 *
 * FIX: Hoisted job_id outside try/catch so the catch block can access it
 * directly without re-parsing the consumed request body. Added console.error
 * logging so errors are visible in edge function logs.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Provider routing types ────────────────────────────────────────────────────

interface FormatProviderConfig {
  provider: 'openai_text' | 'openai_image' | 'elevenlabs' | 'replicate'
  promptTemplatePrefix?: string
}

/**
 * Maps all 74 Phase 1 ContentFormat keys to their AI provider.
 * Also includes legacy job.type fallbacks (text, video, image, audio).
 */
const FORMAT_PROVIDER_MAP: Record<string, FormatProviderConfig> = {
  // ── text — short-form ──────────────────────────────────────────────────────
  tweet:                { provider: 'openai_text', promptTemplatePrefix: 'Write a tweet: ' },
  thread:               { provider: 'openai_text', promptTemplatePrefix: 'Write a Twitter thread: ' },
  caption:              { provider: 'openai_text', promptTemplatePrefix: 'Write a social media caption: ' },
  hook:                 { provider: 'openai_text', promptTemplatePrefix: 'Write an attention-grabbing hook: ' },
  cta:                  { provider: 'openai_text', promptTemplatePrefix: 'Write a call-to-action: ' },
  poll_text:            { provider: 'openai_text', promptTemplatePrefix: 'Write a poll with options: ' },
  quote_post:           { provider: 'openai_text', promptTemplatePrefix: 'Write a quote post: ' },
  status_update:        { provider: 'openai_text', promptTemplatePrefix: 'Write a status update: ' },
  community_post:       { provider: 'openai_text', promptTemplatePrefix: 'Write a community post: ' },
  meme_text:            { provider: 'openai_text', promptTemplatePrefix: 'Write meme text: ' },
  story_text_overlay:   { provider: 'openai_text', promptTemplatePrefix: 'Write story text overlay: ' },
  product_announcement: { provider: 'openai_text', promptTemplatePrefix: 'Write a product announcement: ' },
  // ── text — long-form ──────────────────────────────────────────────────────
  blog_post:            { provider: 'openai_text', promptTemplatePrefix: 'Write a blog post: ' },
  article:              { provider: 'openai_text', promptTemplatePrefix: 'Write an article: ' },
  newsletter:           { provider: 'openai_text', promptTemplatePrefix: 'Write a newsletter: ' },
  seo_page:             { provider: 'openai_text', promptTemplatePrefix: 'Write an SEO-optimised page: ' },
  landing_page_copy:    { provider: 'openai_text', promptTemplatePrefix: 'Write landing page copy: ' },
  product_description:  { provider: 'openai_text', promptTemplatePrefix: 'Write a product description: ' },
  whitepaper:           { provider: 'openai_text', promptTemplatePrefix: 'Write a whitepaper: ' },
  case_study:           { provider: 'openai_text', promptTemplatePrefix: 'Write a case study: ' },
  tutorial:             { provider: 'openai_text', promptTemplatePrefix: 'Write a tutorial: ' },
  guide:                { provider: 'openai_text', promptTemplatePrefix: 'Write a guide: ' },
  press_release:        { provider: 'openai_text', promptTemplatePrefix: 'Write a press release: ' },
  // ── text — conversational ─────────────────────────────────────────────────
  qa_post:              { provider: 'openai_text', promptTemplatePrefix: 'Write a Q&A post: ' },
  ama_content:          { provider: 'openai_text', promptTemplatePrefix: 'Write AMA content: ' },
  community_response:   { provider: 'openai_text', promptTemplatePrefix: 'Write a community response: ' },
  // ── video (script/text output) ────────────────────────────────────────────
  reel:                 { provider: 'openai_text', promptTemplatePrefix: 'Write a Reel script: ' },
  short:                { provider: 'openai_text', promptTemplatePrefix: 'Write a YouTube Short script: ' },
  tiktok_video:         { provider: 'openai_text', promptTemplatePrefix: 'Write a TikTok video script: ' },
  vertical_video:       { provider: 'openai_text', promptTemplatePrefix: 'Write a vertical video script: ' },
  promo_video:          { provider: 'openai_text', promptTemplatePrefix: 'Write a promo video script: ' },
  talking_head_video:   { provider: 'openai_text', promptTemplatePrefix: 'Write a talking-head video script: ' },
  loop_video:           { provider: 'openai_text', promptTemplatePrefix: 'Write a loop video script: ' },
  youtube_video:        { provider: 'openai_text', promptTemplatePrefix: 'Write a YouTube video script: ' },
  tutorial_video:       { provider: 'openai_text', promptTemplatePrefix: 'Write a tutorial video script: ' },
  product_demo:         { provider: 'openai_text', promptTemplatePrefix: 'Write a product demo script: ' },
  faceless_video:       { provider: 'openai_text', promptTemplatePrefix: 'Write a faceless video script: ' },
  voiceover_video:      { provider: 'openai_text', promptTemplatePrefix: 'Write a voiceover video script: ' },
  subtitle_video:       { provider: 'openai_text', promptTemplatePrefix: 'Write subtitle text for a video: ' },
  ai_explainer_video:   { provider: 'openai_text', promptTemplatePrefix: 'Write an AI explainer video script: ' },
  repurposed_clip:      { provider: 'openai_text', promptTemplatePrefix: 'Write a repurposed clip script: ' },
  // ── image ─────────────────────────────────────────────────────────────────
  single_image_post:    { provider: 'openai_image' },
  poster:               { provider: 'openai_image' },
  ai_art:               { provider: 'openai_image' },
  infographic:          { provider: 'openai_image' },
  motivational_graphic: { provider: 'openai_image' },
  product_image:        { provider: 'openai_image' },
  branded_creative:     { provider: 'openai_image' },
  event_poster:         { provider: 'openai_image' },
  announcement_banner:  { provider: 'openai_image' },
  carousel:             { provider: 'openai_image' },
  swipe_post:           { provider: 'openai_image' },
  before_after_set:     { provider: 'openai_image' },
  educational_slides:   { provider: 'openai_image' },
  lookbook:             { provider: 'openai_image' },
  ai_generated_image:   { provider: 'openai_image' },
  meme:                 { provider: 'openai_image' },
  gif:                  { provider: 'openai_image' },
  // ── audio ─────────────────────────────────────────────────────────────────
  podcast_episode:      { provider: 'elevenlabs' },
  voiceover:            { provider: 'elevenlabs' },
  tts_narration:        { provider: 'elevenlabs' },
  audio_blog:           { provider: 'elevenlabs' },
  voice_note:           { provider: 'elevenlabs' },
  audio_ad:             { provider: 'elevenlabs' },
  multilingual_dub:     { provider: 'elevenlabs' },
  // ── story ─────────────────────────────────────────────────────────────────
  story_single:         { provider: 'openai_text', promptTemplatePrefix: 'Write a story: ' },
  story_sequence:       { provider: 'openai_text', promptTemplatePrefix: 'Write a story sequence: ' },
  poll_story:           { provider: 'openai_text', promptTemplatePrefix: 'Write a poll story: ' },
  quiz_story:           { provider: 'openai_text', promptTemplatePrefix: 'Write a quiz story: ' },
  countdown_story:      { provider: 'openai_text', promptTemplatePrefix: 'Write a countdown story: ' },
  link_story:           { provider: 'openai_text', promptTemplatePrefix: 'Write a link story: ' },
  product_story:        { provider: 'openai_text', promptTemplatePrefix: 'Write a product story: ' },
  // ── legacy job.type fallbacks ─────────────────────────────────────────────
  text:                 { provider: 'openai_text' },
  video:                { provider: 'openai_text' },
  image:                { provider: 'openai_image' },
  audio:                { provider: 'elevenlabs' },
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const openaiKey    = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('OpenAI API')
  const elevenKey    = Deno.env.get('ELEVENLABS_API_KEY')

  const supabase = createClient(supabaseUrl, serviceKey)

  // Hoist job_id so the catch block can reference it without re-parsing the body
  let job_id: string | null = null

  try {
    const body = await req.json() as { job_id: string }
    job_id = body.job_id

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: 'job_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch the job
    const { data: job, error: fetchError } = await supabase
      .from('content_jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (fetchError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Metadata schema validation ────────────────────────────────────────────
    const metadata = (job.metadata as Record<string, unknown> | null) ?? {}
    const contentCategory = metadata.contentCategory
    const contentFormat   = metadata.contentFormat

    if (contentCategory == null || contentFormat == null) {
      const validationError = 'Invalid metadata: contentCategory and contentFormat are required.'
      await supabase
        .from('content_jobs')
        .update({ status: 'failed', error_message: validationError, updated_at: new Date().toISOString() })
        .eq('id', job_id)

      const { data: failWallet } = await supabase
        .from('wallets')
        .select('id, reserved')
        .eq('user_id', job.user_id)
        .is('team_id', null)
        .maybeSingle()

      if (failWallet && job.credits_reserved) {
        await supabase
          .from('wallets')
          .update({ reserved: Math.max(0, failWallet.reserved - job.credits_reserved) })
          .eq('id', failWallet.id)
      }

      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Resolve provider config
    const formatConfig = FORMAT_PROVIDER_MAP[contentFormat as string] ?? FORMAT_PROVIDER_MAP[job.type]
    const schemaVersion = (metadata.schemaVersion as string) ?? '0'

    // Helper: fail job + release credits + return error response
    const failJobWithCredits = async (msg: string): Promise<Response> => {
      await supabase
        .from('content_jobs')
        .update({ status: 'failed', error_message: msg, updated_at: new Date().toISOString() })
        .eq('id', job_id!)

      const { data: fw } = await supabase
        .from('wallets')
        .select('id, reserved')
        .eq('user_id', job.user_id)
        .is('team_id', null)
        .maybeSingle()

      if (fw && job.credits_reserved) {
        await supabase
          .from('wallets')
          .update({ reserved: Math.max(0, fw.reserved - job.credits_reserved) })
          .eq('id', fw.id)
      }

      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let sourceContent: string | null = null
    const sourceJobId   = metadata.sourceJobId   as string | null | undefined
    const sourceMediaId = metadata.sourceMediaId as string | null | undefined

    if (sourceJobId) {
      const { data: sourceJob } = await supabase
        .from('content_jobs')
        .select('result_url, status')
        .eq('id', sourceJobId)
        .maybeSingle()

      if (!sourceJob || !sourceJob.result_url) {
        return await failJobWithCredits('Source content is no longer available.')
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10_000)
        let sourceRes: Response
        try {
          sourceRes = await fetch(sourceJob.result_url, { signal: controller.signal })
        } finally {
          clearTimeout(timeoutId)
        }
        if (!sourceRes.ok) return await failJobWithCredits('Failed to fetch source content.')
        sourceContent = await sourceRes.text()
      } catch {
        return await failJobWithCredits('Failed to fetch source content.')
      }
    } else if (sourceMediaId) {
      const { data: mediaItem } = await supabase
        .from('media_items')
        .select('public_url, name, type')
        .eq('id', sourceMediaId)
        .maybeSingle()

      if (!mediaItem || !mediaItem.public_url) {
        return await failJobWithCredits('Source content is no longer available.')
      }

      const mediaLabel = mediaItem.name ?? 'Media asset'
      sourceContent = `[Source media — ${mediaLabel} (${mediaItem.type ?? 'file'}): ${mediaItem.public_url}]`
    }

    // Mark as running
    await supabase
      .from('content_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', job_id)

    let resultText: string | null = null
    let resultUrl: string | null  = null

    // ── Route to AI provider ──────────────────────────────────────────────────
    if (schemaVersion === '0') {
      // Legacy routing: use job.type
      if (job.type === 'text' || job.type === 'video') {
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

        const rawModel     = (job.metadata?.model as string) ?? 'gpt-4o'
        const MODEL_MAP2: Record<string, string> = { 'gpt-3.5': 'gpt-3.5-turbo', 'gpt-4': 'gpt-4', 'gpt-4o': 'gpt-4o', 'gpt-4o-mini': 'gpt-4o-mini', 'gpt-3.5-turbo': 'gpt-3.5-turbo' }
        const model        = MODEL_MAP2[rawModel] ?? 'gpt-4o'
        const tone         = (job.metadata?.tone as string)           ?? 'professional'
        const outputFormat = (job.metadata?.output_format as string)  ?? 'blog_post'
        const wordCountMax = (job.metadata?.word_count_max as number) ?? 1000
        const language     = (job.metadata?.language as string)       ?? 'en'
        const brandVoice   = (job.metadata?.brand_voice as string | null) ?? null

        const { data: brandProfile } = await supabase
          .from('brand_profiles')
          .select('voice_guidelines')
          .eq('user_id', job.user_id)
          .maybeSingle()

        const voiceGuidelines = brandVoice ?? brandProfile?.voice_guidelines ?? null
        const repurposingInstructions = (metadata.repurposingInstructions as string | null) ?? null
        const repurposingContext = sourceContent
          ? `\n\nSource content to repurpose:\n${sourceContent}${repurposingInstructions ? `\n\nRepurposing instructions: ${repurposingInstructions}` : ''}`
          : ''

        const systemPrompt = voiceGuidelines
          ? `You are a content creator. Brand voice: ${voiceGuidelines}. Tone: ${tone}. Output format: ${outputFormat}. Language: ${language}.${repurposingContext}`
          : `You are a professional content creator. Tone: ${tone}. Output format: ${outputFormat}. Language: ${language}.${repurposingContext}`

        const maxTokens = job.type === 'video' ? 2000 : Math.ceil(wordCountMax * 1.5)

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: job.prompt },
            ],
            max_tokens: maxTokens,
          }),
        })

        if (!openaiRes.ok) {
          const err = await openaiRes.text()
          throw new Error(`OpenAI error: ${err}`)
        }

        const openaiData = await openaiRes.json() as { choices: Array<{ message: { content: string } }> }
        resultText = openaiData.choices[0]?.message?.content ?? ''

        const fileName = `${job.user_id}/${job_id}.txt`
        const { error: uploadError } = await supabase.storage
          .from('generated-content')
          .upload(fileName, new Blob([resultText], { type: 'text/plain' }), { upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('generated-content').getPublicUrl(fileName)
          resultUrl = urlData.publicUrl
        }

      } else if (job.type === 'image') {
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

        const resolution = (job.metadata?.resolution as string) ?? '1024x1024'
        const style      = (job.metadata?.style as string)      ?? 'photorealistic'
        const numImages  = (job.metadata?.num_images as number) ?? 1
        const styledPrompt = style ? `${job.prompt} Style: ${style}.` : job.prompt

        const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'dall-e-3', prompt: styledPrompt, n: numImages, size: resolution, response_format: 'url' }),
        })

        if (!dalleRes.ok) { const err = await dalleRes.text(); throw new Error(`DALL-E error: ${err}`) }

        const dalleData = await dalleRes.json() as { data: Array<{ url: string }> }
        const imageUrl = dalleData.data[0]?.url

        if (imageUrl) {
          const imgBlob  = await (await fetch(imageUrl)).blob()
          const fileName = `${job.user_id}/${job_id}.png`
          const { error: uploadError } = await supabase.storage
            .from('generated-content')
            .upload(fileName, imgBlob, { contentType: 'image/png', upsert: true })

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('generated-content').getPublicUrl(fileName)
            resultUrl = urlData.publicUrl
          } else {
            resultUrl = imageUrl
          }
        }

      } else if (job.type === 'audio') {
        if (!elevenKey) throw new Error('ELEVENLABS_API_KEY not configured')

        const voiceId         = (job.metadata?.voice_id as string)          ?? '21m00Tcm4TlvDq8ikWAM'
        const speakingRate    = (job.metadata?.speaking_rate as number)      ?? 1.0
        const stabilityClarity = (job.metadata?.stability_clarity as number) ?? 50
        const outputFmt       = (job.metadata?.output_format as string)      ?? 'mp3'
        const audioExt        = outputFmt === 'wav' ? 'wav' : 'mp3'
        const audioContentType = outputFmt === 'wav' ? 'audio/wav' : 'audio/mpeg'

        const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: job.prompt,
            model_id: 'eleven_monolingual_v1',
            voice_settings: { stability: stabilityClarity / 100, similarity_boost: 0.75, speaking_rate: speakingRate },
          }),
        })

        if (!elevenRes.ok) { const err = await elevenRes.text(); throw new Error(`ElevenLabs error: ${err}`) }

        const audioBlob = await elevenRes.blob()
        const fileName  = `${job.user_id}/${job_id}.${audioExt}`
        const { error: uploadError } = await supabase.storage
          .from('generated-content')
          .upload(fileName, audioBlob, { contentType: audioContentType, upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('generated-content').getPublicUrl(fileName)
          resultUrl = urlData.publicUrl
        }
      }

    } else {
      // schemaVersion '1': route via formatConfig.provider
      if (!formatConfig) throw new Error(`Unknown content format: ${String(contentFormat)}`)

      if (formatConfig.provider === 'openai_text') {
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

        const advOpts      = (metadata.advancedOptions as Record<string, unknown>) ?? {}
        const rawModel     = (advOpts.model as string) ?? (metadata.model as string) ?? 'gpt-4o'
        // Sanitize legacy/invalid model names to valid OpenAI identifiers
        const MODEL_MAP: Record<string, string> = { 'gpt-3.5': 'gpt-3.5-turbo', 'gpt-4': 'gpt-4', 'gpt-4o': 'gpt-4o', 'gpt-4o-mini': 'gpt-4o-mini', 'gpt-3.5-turbo': 'gpt-3.5-turbo' }
        const model        = MODEL_MAP[rawModel] ?? 'gpt-4o'
        const tone         = (metadata.tone as string)        ?? 'professional'
        const outputFormat = (advOpts.outputFormat as string) ?? (metadata.output_format as string)  ?? 'blog_post'
        const wordCountMax = ((metadata.length as Record<string, unknown>)?.maxWords as number)
          ?? (metadata.word_count_max as number) ?? 1000
        const language   = (advOpts.language as string)    ?? (metadata.language as string)   ?? 'en'
        const brandVoice = (advOpts.brandVoice as string | null) ?? (metadata.brand_voice as string | null) ?? null

        const { data: brandProfile } = await supabase
          .from('brand_profiles')
          .select('voice_guidelines')
          .eq('user_id', job.user_id)
          .maybeSingle()

        const voiceGuidelines = brandVoice ?? brandProfile?.voice_guidelines ?? null
        const repurposingInstructions = (metadata.repurposingInstructions as string | null) ?? null
        const repurposingContext = sourceContent
          ? `\n\nSource content to repurpose:\n${sourceContent}${repurposingInstructions ? `\n\nRepurposing instructions: ${repurposingInstructions}` : ''}`
          : ''

        const systemPrompt = voiceGuidelines
          ? `You are a content creator. Brand voice: ${voiceGuidelines}. Tone: ${tone}. Output format: ${outputFormat}. Language: ${language}.${repurposingContext}`
          : `You are a professional content creator. Tone: ${tone}. Output format: ${outputFormat}. Language: ${language}.${repurposingContext}`

        const userPrompt = formatConfig.promptTemplatePrefix
          ? `${formatConfig.promptTemplatePrefix}${job.prompt}`
          : job.prompt

        const maxTokens = Math.ceil(wordCountMax * 1.5)

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: userPrompt },
            ],
            max_tokens: maxTokens,
          }),
        })

        if (!openaiRes.ok) {
          const err = await openaiRes.text()
          throw new Error(`OpenAI error: ${err}`)
        }

        const openaiData = await openaiRes.json() as { choices: Array<{ message: { content: string } }> }
        resultText = openaiData.choices[0]?.message?.content ?? ''

        const fileName = `${job.user_id}/${job_id}.txt`
        const { error: uploadError } = await supabase.storage
          .from('generated-content')
          .upload(fileName, new Blob([resultText], { type: 'text/plain' }), { upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('generated-content').getPublicUrl(fileName)
          resultUrl = urlData.publicUrl
        }

      } else if (formatConfig.provider === 'openai_image') {
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

        const advOpts    = (metadata.advancedOptions as Record<string, unknown>) ?? {}
        const resolution = (advOpts.resolution as string) ?? (metadata.resolution as string) ?? '1024x1024'
        const style      = (advOpts.style as string)      ?? (metadata.style as string)      ?? 'photorealistic'
        const numImages  = ((metadata.length as Record<string, unknown>)?.quantity as number)
          ?? (metadata.num_images as number) ?? 1
        const styledPrompt = style ? `${job.prompt} Style: ${style}.` : job.prompt

        const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'dall-e-3', prompt: styledPrompt, n: numImages, size: resolution, response_format: 'url' }),
        })

        if (!dalleRes.ok) { const err = await dalleRes.text(); throw new Error(`DALL-E error: ${err}`) }

        const dalleData = await dalleRes.json() as { data: Array<{ url: string }> }
        const imageUrl  = dalleData.data[0]?.url

        if (imageUrl) {
          const imgBlob  = await (await fetch(imageUrl)).blob()
          const fileName = `${job.user_id}/${job_id}.png`
          const { error: uploadError } = await supabase.storage
            .from('generated-content')
            .upload(fileName, imgBlob, { contentType: 'image/png', upsert: true })

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('generated-content').getPublicUrl(fileName)
            resultUrl = urlData.publicUrl
          } else {
            resultUrl = imageUrl
          }
        }

      } else if (formatConfig.provider === 'elevenlabs') {
        if (!elevenKey) throw new Error('ELEVENLABS_API_KEY not configured')

        const advOpts      = (metadata.advancedOptions as Record<string, unknown>) ?? {}
        const voiceId      = (advOpts.voice as string)        ?? (metadata.voice_id as string)       ?? '21m00Tcm4TlvDq8ikWAM'
        const speakingRate = ((metadata.length as Record<string, unknown>)?.speakingRate as number)
          ?? (metadata.speaking_rate as number) ?? 1.0
        const stability        = (advOpts.stability as number) ?? null
        const stabilityClarity = stability !== null ? stability * 100 : ((metadata.stability_clarity as number) ?? 50)
        const outputFmt        = (advOpts.outputFormat as string) ?? (metadata.output_format as string) ?? 'mp3'
        const audioExt         = outputFmt === 'wav' ? 'wav' : 'mp3'
        const audioContentType = outputFmt === 'wav' ? 'audio/wav' : 'audio/mpeg'

        const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: job.prompt,
            model_id: 'eleven_monolingual_v1',
            voice_settings: { stability: stabilityClarity / 100, similarity_boost: 0.75, speaking_rate: speakingRate },
          }),
        })

        if (!elevenRes.ok) { const err = await elevenRes.text(); throw new Error(`ElevenLabs error: ${err}`) }

        const audioBlob = await elevenRes.blob()
        const fileName  = `${job.user_id}/${job_id}.${audioExt}`
        const { error: uploadError } = await supabase.storage
          .from('generated-content')
          .upload(fileName, audioBlob, { contentType: audioContentType, upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('generated-content').getPublicUrl(fileName)
          resultUrl = urlData.publicUrl
        }

      } else {
        throw new Error('Replicate provider not yet implemented')
      }
    }

    // ── Fetch credit cost ─────────────────────────────────────────────────────
    const { data: pricing } = await supabase
      .from('pricing_config')
      .select('credits_cost')
      .eq('content_type', job.type)
      .eq('is_active', true)
      .maybeSingle()

    const creditsUsed = pricing?.credits_cost ?? job.credits_reserved

    // ── Save to media_items ───────────────────────────────────────────────────
    if (resultUrl) {
      const mediaType = job.type === 'text' || job.type === 'video' ? 'document' : job.type
      await supabase.from('media_items').insert({
        user_id:      job.user_id,
        team_id:      job.team_id,
        name:         `Generated ${job.type} — ${new Date().toLocaleDateString()}`,
        type:         mediaType,
        size_bytes:   0,
        storage_path: `${job.user_id}/${job_id}`,
        public_url:   resultUrl,
        metadata:     { job_id, prompt: job.prompt, content_type: job.type },
      })
    }

    // ── Deduct credits from wallet ────────────────────────────────────────────
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, balance, reserved')
      .eq('user_id', job.user_id)
      .is('team_id', null)
      .maybeSingle()

    if (wallet) {
      await supabase
        .from('wallets')
        .update({
          balance:  Math.max(0, wallet.balance - creditsUsed),
          reserved: Math.max(0, wallet.reserved - job.credits_reserved),
        })
        .eq('id', wallet.id)

      await supabase.from('credit_transactions').insert({
        wallet_id:    wallet.id,
        type:         'deduction',
        amount:       -creditsUsed,
        description:  `${job.type} generation`,
        reference_id: job_id,
      })
    }

    // ── Mark job complete ─────────────────────────────────────────────────────
    await supabase
      .from('content_jobs')
      .update({
        status:       'completed',
        result_url:   resultUrl,
        credits_used: creditsUsed,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', job_id)

    return new Response(
      JSON.stringify({ success: true, result_url: resultUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    // Always log so the real error shows in Supabase edge function logs
    console.error('[generate-content] error:', message, err)

    // job_id is hoisted above — safe to use here without re-parsing the body
    if (job_id) {
      try {
        await supabase
          .from('content_jobs')
          .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
          .eq('id', job_id)

        const { data: jobRow } = await supabase
          .from('content_jobs')
          .select('credits_reserved, user_id')
          .eq('id', job_id)
          .maybeSingle()

        if (jobRow) {
          const { data: failWallet } = await supabase
            .from('wallets')
            .select('id, reserved')
            .eq('user_id', jobRow.user_id)
            .is('team_id', null)
            .maybeSingle()

          if (failWallet) {
            await supabase
              .from('wallets')
              .update({ reserved: Math.max(0, failWallet.reserved - (jobRow.credits_reserved ?? 0)) })
              .eq('id', failWallet.id)
          }
        }
      } catch (cleanupErr) {
        console.error('[generate-content] cleanup error:', cleanupErr)
      }
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

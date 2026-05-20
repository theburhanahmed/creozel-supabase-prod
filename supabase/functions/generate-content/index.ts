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
  const openaiKey    = Deno.env.get('OPENAI_API_KEY')
  const elevenKey    = Deno.env.get('ELEVENLABS_API_KEY')
  const replicateKey = Deno.env.get('REPLICATE_API_TOKEN')

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const { job_id } = await req.json() as { job_id: string }

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

    // ── Metadata schema validation (Requirement 18.4) ─────────────────────────
    const metadata = job.metadata as Record<string, unknown> | null ?? {}
    const contentCategory = metadata.contentCategory
    const contentFormat   = metadata.contentFormat

    if (contentCategory == null || contentFormat == null) {
      const validationError = 'Invalid metadata: contentCategory and contentFormat are required.'

      // Mark job as failed
      await supabase
        .from('content_jobs')
        .update({
          status:        'failed',
          error_message: validationError,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', job_id)

      // Release reserved credits (Requirement 18.5 — all error paths must release credits)
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

    // ── Resolve provider config from FORMAT_PROVIDER_MAP (task 16.2) ──────────
    // Falls back to legacy job.type key when contentFormat is not in the map.
    const formatConfig = FORMAT_PROVIDER_MAP[contentFormat as string] ?? FORMAT_PROVIDER_MAP[job.type]

    // ── Read schema version (task 16.3) ───────────────────────────────────────
    // Default to '0' for legacy jobs that predate the ContentFormatMetadataSchema.
    const schemaVersion = (metadata.schemaVersion as string) ?? '0'

    // ── Repurposing source detection (task 16.4, Requirements 17.6, 17.8, 18.5) ──
    // Helper: fail job + release credits + return 400 response
    const failJobWithCredits = async (msg: string): Promise<Response> => {
      await supabase
        .from('content_jobs')
        .update({ status: 'failed', error_message: msg, updated_at: new Date().toISOString() })
        .eq('id', job_id)

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
      // Fetch the source content_jobs row
      const { data: sourceJob } = await supabase
        .from('content_jobs')
        .select('result_url, status')
        .eq('id', sourceJobId)
        .maybeSingle()

      if (!sourceJob || !sourceJob.result_url) {
        return await failJobWithCredits('Source content is no longer available.')
      }

      // Fetch the text content from result_url with a 10-second timeout
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10_000)

        let sourceRes: Response
        try {
          sourceRes = await fetch(sourceJob.result_url, { signal: controller.signal })
        } finally {
          clearTimeout(timeoutId)
        }

        if (!sourceRes.ok) {
          return await failJobWithCredits('Failed to fetch source content.')
        }

        sourceContent = await sourceRes.text()
      } catch {
        return await failJobWithCredits('Failed to fetch source content.')
      }
    } else if (sourceMediaId) {
      // Fetch the source media_items row (Requirement 17.6, 17.8)
      const { data: mediaItem } = await supabase
        .from('media_items')
        .select('public_url, name, type')
        .eq('id', sourceMediaId)
        .maybeSingle()

      if (!mediaItem || !mediaItem.public_url) {
        return await failJobWithCredits('Source content is no longer available.')
      }

      // Inject the media public_url as context for the AI prompt.
      // For image/video/audio assets the URL is the primary reference;
      // for document assets the URL points to the stored file.
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
      // ── Legacy routing: use job.type (schemaVersion '0') ───────────────────
      if (job.type === 'text' || job.type === 'video') {
        // Text and video scripts use OpenAI
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

        // Read advanced options from metadata with safe fallbacks (task 15.1)
        const model = (job.metadata?.model as string) ?? 'gpt-4'
        const tone = (job.metadata?.tone as string) ?? 'professional'
        const outputFormat = (job.metadata?.output_format as string) ?? 'blog_post'
        const wordCountMax = (job.metadata?.word_count_max as number) ?? 1000
        const language = (job.metadata?.language as string) ?? 'en'
        const brandVoice = (job.metadata?.brand_voice as string | null) ?? null

        // Fetch brand voice from brand_profiles table (non-fatal if missing)
        const { data: brandProfile } = await supabase
          .from('brand_profiles')
          .select('voice_guidelines')
          .eq('user_id', job.user_id)
          .maybeSingle()

        const voiceGuidelines = brandVoice ?? brandProfile?.voice_guidelines ?? null

        const repurposingInstructions = (metadata.repurposingInstructions as string | null | undefined) ?? null
        const repurposingContext = sourceContent
          ? `\n\nSource content to repurpose:\n${sourceContent}${repurposingInstructions ? `\n\nRepurposing instructions: ${repurposingInstructions}` : ''}`
          : ''

        const systemPrompt = voiceGuidelines
          ? `You are a content creator. Brand voice: ${voiceGuidelines}. Tone: ${tone}. Output format: ${outputFormat}. Language: ${language}.${repurposingContext}`
          : `You are a professional content creator. Tone: ${tone}. Output format: ${outputFormat}. Language: ${language}.${repurposingContext}`

        // Approximate token count: wordCountMax * 1.5 (task 15.2)
        const maxTokens = job.type === 'video' ? 2000 : Math.ceil(wordCountMax * 1.5)

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: job.prompt },
            ],
            max_tokens: maxTokens,
          }),
        })

        if (!openaiRes.ok) {
          const err = await openaiRes.text()
          throw new Error(`OpenAI error: ${err}`)
        }

        const openaiData = await openaiRes.json() as {
          choices: Array<{ message: { content: string } }>
        }
        resultText = openaiData.choices[0]?.message?.content ?? ''

        // Store text result in Storage as a .txt file
        const fileName = `${job.user_id}/${job_id}.txt`
        const { error: uploadError } = await supabase.storage
          .from('generated-content')
          .upload(fileName, new Blob([resultText], { type: 'text/plain' }), {
            upsert: true,
          })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('generated-content')
            .getPublicUrl(fileName)
          resultUrl = urlData.publicUrl
        }

      } else if (job.type === 'image') {
        // Images use DALL-E 3
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

        // Read advanced options from metadata with safe fallbacks (task 15.1)
        const resolution = (job.metadata?.resolution as string) ?? '1024x1024'
        const style = (job.metadata?.style as string) ?? 'photorealistic'
        const numImages = (job.metadata?.num_images as number) ?? 1
        // seed and negativePrompt are read but not passed to DALL-E (not supported by the API)
        // They are preserved here for potential future use with Stable Diffusion
        // const negativePrompt = (job.metadata?.negative_prompt as string) ?? ''
        // const seed = (job.metadata?.seed as number | undefined)

        // Append style to prompt if set (task 15.2)
        const styledPrompt = style ? `${job.prompt} Style: ${style}.` : job.prompt

        const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: styledPrompt,
            n: numImages,
            size: resolution,
            response_format: 'url',
          }),
        })

        if (!dalleRes.ok) {
          const err = await dalleRes.text()
          throw new Error(`DALL-E error: ${err}`)
        }

        const dalleData = await dalleRes.json() as { data: Array<{ url: string }> }
        const imageUrl = dalleData.data[0]?.url

        if (imageUrl) {
          // Download and re-upload to our Storage for persistence
          const imgRes = await fetch(imageUrl)
          const imgBlob = await imgRes.blob()
          const fileName = `${job.user_id}/${job_id}.png`

          const { error: uploadError } = await supabase.storage
            .from('generated-content')
            .upload(fileName, imgBlob, { contentType: 'image/png', upsert: true })

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('generated-content')
              .getPublicUrl(fileName)
            resultUrl = urlData.publicUrl
          } else {
            resultUrl = imageUrl // Fall back to DALL-E URL
          }
        }

      } else if (job.type === 'audio') {
        // Audio uses ElevenLabs TTS
        if (!elevenKey) throw new Error('ELEVENLABS_API_KEY not configured')

        // Read advanced options from metadata with safe fallbacks (task 15.1)
        const voiceId = (job.metadata?.voice_id as string) ?? '21m00Tcm4TlvDq8ikWAM' // Default: Rachel
        const speakingRate = (job.metadata?.speaking_rate as number) ?? 1.0
        const stabilityClarity = (job.metadata?.stability_clarity as number) ?? 50
        const outputFormat = (job.metadata?.output_format as string) ?? 'mp3'

        // Determine file extension from output format
        const audioExt = outputFormat === 'wav' ? 'wav' : 'mp3'
        const audioContentType = outputFormat === 'wav' ? 'audio/wav' : 'audio/mpeg'

        const elevenRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: job.prompt,
              model_id: 'eleven_monolingual_v1',
              // Pass stability (normalised 0–1) and speaking_rate from metadata (task 15.2)
              voice_settings: {
                stability: stabilityClarity / 100,
                similarity_boost: 0.75,
                speaking_rate: speakingRate,
              },
            }),
          },
        )

        if (!elevenRes.ok) {
          const err = await elevenRes.text()
          throw new Error(`ElevenLabs error: ${err}`)
        }

        const audioBlob = await elevenRes.blob()
        const fileName = `${job.user_id}/${job_id}.${audioExt}`

        const { error: uploadError } = await supabase.storage
          .from('generated-content')
          .upload(fileName, audioBlob, { contentType: audioContentType, upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('generated-content')
            .getPublicUrl(fileName)
          resultUrl = urlData.publicUrl
        }
      }

    } else {
      // ── schemaVersion '1': route via formatConfig.provider ─────────────────
      if (!formatConfig) throw new Error(`Unknown content format: ${String(contentFormat)}`)

      if (formatConfig.provider === 'openai_text') {
        // OpenAI chat completions — reads from advancedOptions with legacy flat-field fallbacks
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

        const advOpts = (metadata.advancedOptions as Record<string, unknown>) ?? {}
        const model = (advOpts.model as string) ?? (metadata.model as string) ?? 'gpt-4'
        const tone = (metadata.tone as string) ?? 'professional'
        const outputFormat = (advOpts.outputFormat as string) ?? (metadata.output_format as string) ?? 'blog_post'
        const wordCountMax = (metadata.length as Record<string, unknown>)?.maxWords as number
          ?? (metadata.word_count_max as number)
          ?? 1000
        const language = (advOpts.language as string) ?? (metadata.language as string) ?? 'en'
        const brandVoice = (advOpts.brandVoice as string | null) ?? (metadata.brand_voice as string | null) ?? null

        // Fetch brand voice from brand_profiles table (non-fatal if missing)
        const { data: brandProfile } = await supabase
          .from('brand_profiles')
          .select('voice_guidelines')
          .eq('user_id', job.user_id)
          .maybeSingle()

        const voiceGuidelines = brandVoice ?? brandProfile?.voice_guidelines ?? null

        const repurposingInstructions = (metadata.repurposingInstructions as string | null | undefined) ?? null
        const repurposingContext = sourceContent
          ? `\n\nSource content to repurpose:\n${sourceContent}${repurposingInstructions ? `\n\nRepurposing instructions: ${repurposingInstructions}` : ''}`
          : ''

        const systemPrompt = voiceGuidelines
          ? `You are a content creator. Brand voice: ${voiceGuidelines}. Tone: ${tone}. Output format: ${outputFormat}. Language: ${language}.${repurposingContext}`
          : `You are a professional content creator. Tone: ${tone}. Output format: ${outputFormat}. Language: ${language}.${repurposingContext}`

        // Prepend the format-specific prompt template prefix when present
        const userPrompt = formatConfig.promptTemplatePrefix
          ? `${formatConfig.promptTemplatePrefix}${job.prompt}`
          : job.prompt

        const maxTokens = Math.ceil(wordCountMax * 1.5)

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: maxTokens,
          }),
        })

        if (!openaiRes.ok) {
          const err = await openaiRes.text()
          throw new Error(`OpenAI error: ${err}`)
        }

        const openaiData = await openaiRes.json() as {
          choices: Array<{ message: { content: string } }>
        }
        resultText = openaiData.choices[0]?.message?.content ?? ''

        // Store text result in Storage as a .txt file
        const fileName = `${job.user_id}/${job_id}.txt`
        const { error: uploadError } = await supabase.storage
          .from('generated-content')
          .upload(fileName, new Blob([resultText], { type: 'text/plain' }), {
            upsert: true,
          })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('generated-content')
            .getPublicUrl(fileName)
          resultUrl = urlData.publicUrl
        }

      } else if (formatConfig.provider === 'openai_image') {
        // DALL-E 3 image generation
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

        const advOpts = (metadata.advancedOptions as Record<string, unknown>) ?? {}
        const resolution = (advOpts.resolution as string) ?? (metadata.resolution as string) ?? '1024x1024'
        const style = (advOpts.style as string) ?? (metadata.style as string) ?? 'photorealistic'
        const numImages = (metadata.length as Record<string, unknown>)?.quantity as number
          ?? (metadata.num_images as number)
          ?? 1

        // Append style to prompt if set
        const styledPrompt = style ? `${job.prompt} Style: ${style}.` : job.prompt

        const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: styledPrompt,
            n: numImages,
            size: resolution,
            response_format: 'url',
          }),
        })

        if (!dalleRes.ok) {
          const err = await dalleRes.text()
          throw new Error(`DALL-E error: ${err}`)
        }

        const dalleData = await dalleRes.json() as { data: Array<{ url: string }> }
        const imageUrl = dalleData.data[0]?.url

        if (imageUrl) {
          // Download and re-upload to our Storage for persistence
          const imgRes = await fetch(imageUrl)
          const imgBlob = await imgRes.blob()
          const fileName = `${job.user_id}/${job_id}.png`

          const { error: uploadError } = await supabase.storage
            .from('generated-content')
            .upload(fileName, imgBlob, { contentType: 'image/png', upsert: true })

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('generated-content')
              .getPublicUrl(fileName)
            resultUrl = urlData.publicUrl
          } else {
            resultUrl = imageUrl // Fall back to DALL-E URL
          }
        }

      } else if (formatConfig.provider === 'elevenlabs') {
        // ElevenLabs TTS audio generation
        if (!elevenKey) throw new Error('ELEVENLABS_API_KEY not configured')

        const advOpts = (metadata.advancedOptions as Record<string, unknown>) ?? {}
        const voiceId = (advOpts.voice as string) ?? (metadata.voice_id as string) ?? '21m00Tcm4TlvDq8ikWAM' // Default: Rachel
        const speakingRate = (metadata.length as Record<string, unknown>)?.speakingRate as number
          ?? (metadata.speaking_rate as number)
          ?? 1.0
        const stability = (advOpts.stability as number) ?? null
        const stabilityClarity = stability !== null ? stability * 100 : (metadata.stability_clarity as number) ?? 50
        const outputFormat = (advOpts.outputFormat as string) ?? (metadata.output_format as string) ?? 'mp3'

        // Determine file extension from output format
        const audioExt = outputFormat === 'wav' ? 'wav' : 'mp3'
        const audioContentType = outputFormat === 'wav' ? 'audio/wav' : 'audio/mpeg'

        const elevenRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: job.prompt,
              model_id: 'eleven_monolingual_v1',
              voice_settings: {
                stability: stabilityClarity / 100,
                similarity_boost: 0.75,
                speaking_rate: speakingRate,
              },
            }),
          },
        )

        if (!elevenRes.ok) {
          const err = await elevenRes.text()
          throw new Error(`ElevenLabs error: ${err}`)
        }

        const audioBlob = await elevenRes.blob()
        const fileName = `${job.user_id}/${job_id}.${audioExt}`

        const { error: uploadError } = await supabase.storage
          .from('generated-content')
          .upload(fileName, audioBlob, { contentType: audioContentType, upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('generated-content')
            .getPublicUrl(fileName)
          resultUrl = urlData.publicUrl
        }

      } else {
        // replicate — Phase 2, not yet implemented
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

    // Mark job as failed
    try {
      const { job_id } = await req.clone().json() as { job_id?: string }
      if (job_id) {
        await supabase
          .from('content_jobs')
          .select('credits_reserved, user_id')
          .eq('id', job_id)
          .maybeSingle()
          .then(async ({ data: job }) => {
            await supabase
              .from('content_jobs')
              .update({
                status:        'failed',
                error_message: message,
                updated_at:    new Date().toISOString(),
              })
              .eq('id', job_id)

            // Release reserved credits
            if (job) {
              const { data: failWallet } = await supabase
                .from('wallets')
                .select('id, reserved')
                .eq('user_id', job.user_id)
                .is('team_id', null)
                .maybeSingle()

              if (failWallet) {
                await supabase
                  .from('wallets')
                  .update({ reserved: Math.max(0, failWallet.reserved - (job.credits_reserved ?? 0)) })
                  .eq('id', failWallet.id)
              }
            }
          })
      }
    } catch {
      // Best-effort cleanup
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

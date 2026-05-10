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

    // Mark as running
    await supabase
      .from('content_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', job_id)

    let resultText: string | null = null
    let resultUrl: string | null  = null

    // ── Route to AI provider ──────────────────────────────────────────────────
    if (job.type === 'text' || job.type === 'video') {
      // Text and video scripts use OpenAI
      if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

      // Fetch brand voice from brand_profiles table (non-fatal if missing)
      const { data: brandProfile } = await supabase
        .from('brand_profiles')
        .select('voice_guidelines')
        .eq('user_id', job.user_id)
        .maybeSingle()

      const voiceGuidelines = brandProfile?.voice_guidelines ?? null

      const systemPrompt = voiceGuidelines
        ? `You are a content creator. Brand voice: ${voiceGuidelines}. Tone: ${job.metadata?.tone ?? 'professional'}.`
        : `You are a professional content creator. Tone: ${job.metadata?.tone ?? 'professional'}.`

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: job.prompt },
          ],
          max_tokens: job.type === 'video' ? 2000 : 1000,
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

      const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: job.prompt,
          n: 1,
          size: '1024x1024',
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

      const voiceId = (job.metadata?.voice_id as string) ?? '21m00Tcm4TlvDq8ikWAM' // Default: Rachel

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
            voice_settings: { stability: 0.5, similarity_boost: 0.5 },
          }),
        },
      )

      if (!elevenRes.ok) {
        const err = await elevenRes.text()
        throw new Error(`ElevenLabs error: ${err}`)
      }

      const audioBlob = await elevenRes.blob()
      const fileName = `${job.user_id}/${job_id}.mp3`

      const { error: uploadError } = await supabase.storage
        .from('generated-content')
        .upload(fileName, audioBlob, { contentType: 'audio/mpeg', upsert: true })

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('generated-content')
          .getPublicUrl(fileName)
        resultUrl = urlData.publicUrl
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

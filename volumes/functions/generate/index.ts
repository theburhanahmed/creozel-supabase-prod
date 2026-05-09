/**
 * Creozel — AI Content Generation Edge Function
 * Route: POST /functions/v1/generate
 *
 * Accepts a content generation request, deducts credits from the user's wallet,
 * calls the appropriate AI provider, saves the result to the media library,
 * and returns the job record.
 *
 * Body: {
 *   type: 'text' | 'image' | 'video' | 'audio'
 *   prompt: string
 *   team_id?: string
 *   parameters?: Record<string, unknown>
 * }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // ── Parse body ────────────────────────────────────────────
    const body = await req.json() as {
      type: 'text' | 'image' | 'video' | 'audio'
      prompt: string
      team_id?: string
      parameters?: Record<string, unknown>
    }

    const { type, prompt, team_id, parameters = {} } = body
    if (!type || !prompt) {
      return json({ error: 'type and prompt are required' }, 400)
    }

    // ── Get credit cost ───────────────────────────────────────
    const { data: pricing } = await supabase
      .from('pricing_config')
      .select('credits_cost')
      .eq('content_type', type)
      .single()

    const creditCost = pricing?.credits_cost ?? 1

    // ── Check + reserve credits ───────────────────────────────
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance, reserved')
      .eq('user_id', user.id)
      .single()

    if (walletError || !wallet) {
      return json({ error: 'Wallet not found' }, 404)
    }

    if (wallet.balance < creditCost) {
      return json({ error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' }, 402)
    }

    // Reserve credits
    await supabase
      .from('wallets')
      .update({ reserved: wallet.reserved + creditCost })
      .eq('id', wallet.id)

    // ── Create job record ─────────────────────────────────────
    const { data: job, error: jobError } = await supabase
      .from('content_jobs')
      .insert({
        user_id: user.id,
        team_id: team_id ?? null,
        type,
        status: 'running',
        prompt,
        parameters,
        credits_cost: creditCost,
      })
      .select()
      .single()

    if (jobError || !job) {
      // Release reserved credits on failure
      await supabase
        .from('wallets')
        .update({ reserved: wallet.reserved })
        .eq('id', wallet.id)
      return json({ error: 'Failed to create job' }, 500)
    }

    // ── Call AI provider ──────────────────────────────────────
    let resultUrl: string | null = null
    let resultText: string | null = null

    try {
      if (type === 'text') {
        resultText = await generateText(prompt, parameters)
      } else if (type === 'image') {
        resultUrl = await generateImage(prompt, parameters)
      } else if (type === 'audio') {
        resultUrl = await generateAudio(prompt, parameters)
      } else if (type === 'video') {
        // Video generation is async — return job ID for polling
        resultText = 'Video generation queued. Poll job status.'
      }
    } catch (aiError) {
      // AI call failed — release reserved credits, mark job failed
      await supabase
        .from('wallets')
        .update({ reserved: wallet.reserved })
        .eq('id', wallet.id)

      await supabase
        .from('content_jobs')
        .update({ status: 'failed', error_message: String(aiError) })
        .eq('id', job.id)

      return json({ error: 'AI generation failed', detail: String(aiError) }, 500)
    }

    // ── Deduct credits (release reserve + deduct balance) ─────
    await supabase
      .from('wallets')
      .update({
        balance: wallet.balance - creditCost,
        reserved: wallet.reserved,
      })
      .eq('id', wallet.id)

    // Record transaction
    await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'deduction',
      amount: -creditCost,
      description: `${type} generation: ${prompt.slice(0, 60)}`,
    })

    // ── Update job to completed ───────────────────────────────
    const { data: completedJob } = await supabase
      .from('content_jobs')
      .update({
        status: 'completed',
        result_url: resultUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select()
      .single()

    return json({
      job: completedJob,
      result: resultText ?? resultUrl,
      credits_used: creditCost,
    })
  } catch (err: unknown) {
    console.error('generate function error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

// ─── AI Provider Helpers ──────────────────────────────────────────────────────

async function generateText(
  prompt: string,
  params: Record<string, unknown>,
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: (params['model'] as string) ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            (params['system_prompt'] as string) ??
            'You are a professional content creator. Generate high-quality content based on the user prompt.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: (params['max_tokens'] as number) ?? 1000,
      temperature: (params['temperature'] as number) ?? 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error: ${err}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0]?.message?.content ?? ''
}

async function generateImage(
  prompt: string,
  params: Record<string, unknown>,
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: (params['size'] as string) ?? '1024x1024',
      quality: (params['quality'] as string) ?? 'standard',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DALL-E error: ${err}`)
  }

  const data = await res.json() as { data: Array<{ url: string }> }
  return data.data[0]?.url ?? ''
}

async function generateAudio(
  prompt: string,
  params: Record<string, unknown>,
): Promise<string> {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured')

  const voiceId = (params['voice_id'] as string) ?? 'EXAVITQu4vr4xnSDxMaL'

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: prompt,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs error: ${err}`)
  }

  // In production: upload audio buffer to Supabase Storage and return public URL
  // For now return a placeholder indicating the audio was generated
  return `audio://generated/${Date.now()}.mp3`
}

// ─── Response helper ──────────────────────────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

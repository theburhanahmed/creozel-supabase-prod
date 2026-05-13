/**
 * Edge Function: create-checkout
 *
 * Creates a Dodo Payments Checkout Session and returns the checkout URL.
 *
 * Request body (POST, requires Authorization: Bearer <supabase_jwt>):
 *   { product_id: string, user_id: string, wallet_id: string }
 *
 * Success Response (200):
 *   { checkout_url: string, payment_id: string }
 *
 * Error Responses:
 *   400: { error: 'invalid_request' }                  — missing/empty fields
 *   401: { error: 'unauthorized' }                     — missing/invalid JWT
 *   500: { error: 'payment_provider_not_configured' }  — missing API key
 *   502: { error: 'checkout_creation_failed' }         — Dodo Payments API error
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase    = createClient(supabaseUrl, serviceKey)

  try {
    // ── 1. Read and validate environment variables ────────────────────────────
    const dodoApiKey     = Deno.env.get('DODO_PAYMENTS_API_KEY')
    const dodoEnv        = Deno.env.get('DODO_PAYMENTS_ENVIRONMENT') ?? 'test_mode'
    const frontendUrl    = Deno.env.get('FRONTEND_URL') ?? ''

    if (!dodoApiKey) {
      console.error('[create-checkout] DODO_PAYMENTS_API_KEY is not configured')
      return new Response(
        JSON.stringify({ error: 'payment_provider_not_configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Validate JWT ───────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 3. Parse and validate request body ───────────────────────────────────
    let body: { product_id?: unknown; user_id?: unknown; wallet_id?: unknown }
    try {
      body = await req.json() as typeof body
    } catch {
      return new Response(
        JSON.stringify({ error: 'invalid_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { product_id, user_id, wallet_id } = body

    if (
      !product_id || typeof product_id !== 'string' || product_id.trim() === '' ||
      !user_id    || typeof user_id    !== 'string' || user_id.trim()    === '' ||
      !wallet_id  || typeof wallet_id  !== 'string' || wallet_id.trim()  === ''
    ) {
      return new Response(
        JSON.stringify({ error: 'invalid_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 4. Fetch customer email from profiles ─────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single()

    if (profileError || !profile?.email) {
      console.error('[create-checkout] Failed to fetch profile email:', profileError?.message)
      return new Response(
        JSON.stringify({ error: 'invalid_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 5. Determine Dodo Payments base URL ───────────────────────────────────
    const dodoBaseUrl = dodoEnv === 'live_mode'
      ? 'https://live.dodopayments.com'
      : 'https://test.dodopayments.com'

    const returnUrl = `${frontendUrl}/credits/add?status=success`

    // ── 6. POST to Dodo Payments Checkout Sessions API ────────────────────────
    const dodoRes = await fetch(`${dodoBaseUrl}/checkout-sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dodoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [{ product_id: product_id.trim(), quantity: 1 }],
        customer: { email: profile.email },
        return_url: returnUrl,
        metadata: { metadata_wallet_id: wallet_id.trim() },
        environment: dodoEnv,
      }),
    })

    if (!dodoRes.ok) {
      const errText = await dodoRes.text()
      console.error('[create-checkout] Dodo Payments API error:', dodoRes.status, errText)
      return new Response(
        JSON.stringify({ error: 'checkout_creation_failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const dodoData = await dodoRes.json() as {
      checkout_url?: string
      payment_id?: string
      url?: string
      id?: string
    }

    // Normalise field names — Dodo may return url/id or checkout_url/payment_id
    const checkoutUrl = dodoData.checkout_url ?? dodoData.url
    const paymentId   = dodoData.payment_id   ?? dodoData.id

    if (!checkoutUrl || !paymentId) {
      console.error('[create-checkout] Unexpected Dodo response shape:', JSON.stringify(dodoData))
      return new Response(
        JSON.stringify({ error: 'checkout_creation_failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 7. Return success ─────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ checkout_url: checkoutUrl, payment_id: paymentId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[create-checkout] error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

/**
 * Edge Function: admin-topup
 *
 * Manually credits a wallet using the `manual_credit_topup` DB function.
 * Requires a service-role JWT — intended for admin use and sandbox testing.
 *
 * Request body (POST, requires Authorization: Bearer <service-role jwt>):
 *   { wallet_id: string, amount: number, description: string }
 *
 * Success Response (200):
 *   { new_balance: number }
 *
 * Error Responses:
 *   401: { error: 'unauthorized' }   — missing/invalid JWT or not service-role
 *   500: { error: 'topup_failed' }   — DB error from manual_credit_topup
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
    // ── 1. Validate JWT for service-role claim ────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '').trim()

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Decode the JWT payload (middle segment) to check the role claim
    let jwtPayload: Record<string, unknown>
    try {
      const payloadSegment = jwt.split('.')[1]
      if (!payloadSegment) throw new Error('malformed jwt')
      // Pad base64url to standard base64 before decoding
      const padded = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
      const decoded = atob(padded)
      jwtPayload = JSON.parse(decoded) as Record<string, unknown>
    } catch {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (jwtPayload.role !== 'service_role') {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Extract admin_user_id from the JWT sub claim
    const adminUserId = (jwtPayload.sub as string | undefined) ?? null

    // ── 2. Parse request body ─────────────────────────────────────────────────
    let body: { wallet_id?: unknown; amount?: unknown; description?: unknown }
    try {
      body = await req.json() as typeof body
    } catch {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { wallet_id, amount, description } = body

    // ── 3. Call manual_credit_topup RPC ───────────────────────────────────────
    const { data, error: rpcError } = await supabase.rpc('manual_credit_topup', {
      wallet_id:     wallet_id,
      amount:        amount,
      description:   description ?? '',
      admin_user_id: adminUserId,
    })

    if (rpcError) {
      console.error('[admin-topup] manual_credit_topup error:', rpcError.message)
      return new Response(
        JSON.stringify({ error: 'topup_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 4. Return updated balance ─────────────────────────────────────────────
    return new Response(
      JSON.stringify({ new_balance: data as number }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[admin-topup] error:', message)
    return new Response(
      JSON.stringify({ error: 'topup_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

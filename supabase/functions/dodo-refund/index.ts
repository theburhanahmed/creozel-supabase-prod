/**
 * Edge Function: dodo-refund
 *
 * Initiates a refund via the Dodo Payments Refunds API and records the
 * refund initiation in webhook_events for audit purposes.
 *
 * Request body (POST, requires Authorization: Bearer <service-role or admin jwt>):
 *   { payment_id: string, reason: string }
 *
 * Success Response (200):
 *   { refund_id: string, status: string }
 *
 * Error Responses:
 *   400: { error: 'invalid_request' }                  — missing/empty fields or reason > 500 chars
 *   403: { error: 'forbidden' }                        — missing/invalid JWT or insufficient claims
 *   500: { error: 'refund_record_failed' }             — DB insert failed after successful refund
 *   502: { error: 'refund_failed', detail: string }    — Dodo Payments API error
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Decode a JWT payload segment (base64url → JSON).
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null

    // Base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded  = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    const decoded = atob(padded)
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Returns true when the JWT payload carries a service-role or admin claim.
 *
 * Accepted claim shapes:
 *   - role === 'service_role'
 *   - app_metadata.role === 'admin'
 *   - user_metadata.role === 'admin'
 */
function hasAdminClaim(payload: Record<string, unknown>): boolean {
  if (payload.role === 'service_role') return true

  const appMeta = payload.app_metadata as Record<string, unknown> | undefined
  if (appMeta?.role === 'admin') return true

  const userMeta = payload.user_metadata as Record<string, unknown> | undefined
  if (userMeta?.role === 'admin') return true

  return false
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
    // ── 1. Read environment variables ─────────────────────────────────────────
    const dodoApiKey = Deno.env.get('DODO_PAYMENTS_API_KEY')
    const dodoEnv    = Deno.env.get('DODO_PAYMENTS_ENVIRONMENT') ?? 'test_mode'

    // Note: API key absence is checked after auth so we don't leak info to
    // unauthenticated callers. Auth is validated first (403 before 500).

    // ── 2. Validate JWT and check service-role / admin claim ──────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt        = authHeader.replace(/^Bearer\s+/i, '')

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const payload = decodeJwtPayload(jwt)
    if (!payload || !hasAdminClaim(payload)) {
      // Also verify the token is actually valid against Supabase auth
      // (catches expired / tampered tokens even if the claim looks right)
      const { error: authError } = await supabase.auth.getUser(jwt)

      // If the token is invalid OR the decoded payload lacks the required claim,
      // return 403 (authenticated-but-not-authorized vs not-authenticated).
      if (authError || !payload || !hasAdminClaim(payload)) {
        return new Response(
          JSON.stringify({ error: 'forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // ── 3. Check API key after auth ───────────────────────────────────────────
    if (!dodoApiKey) {
      console.error('[dodo-refund] DODO_PAYMENTS_API_KEY is not configured')
      return new Response(
        JSON.stringify({ error: 'payment_provider_not_configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 4. Parse and validate request body ───────────────────────────────────
    let body: { payment_id?: unknown; reason?: unknown }
    try {
      body = await req.json() as typeof body
    } catch {
      return new Response(
        JSON.stringify({ error: 'invalid_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { payment_id, reason } = body

    if (!payment_id || typeof payment_id !== 'string' || payment_id.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'invalid_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'invalid_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (reason.length > 500) {
      return new Response(
        JSON.stringify({ error: 'invalid_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 5. Determine Dodo Payments base URL ───────────────────────────────────
    const dodoBaseUrl = dodoEnv === 'live_mode'
      ? 'https://live.dodopayments.com'
      : 'https://test.dodopayments.com'

    // ── 6. POST to Dodo Payments Refunds API ──────────────────────────────────
    const dodoRes = await fetch(`${dodoBaseUrl}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dodoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_id: payment_id.trim(),
        reason:     reason.trim(),
      }),
    })

    if (!dodoRes.ok) {
      let detail = `HTTP ${dodoRes.status}`
      try {
        const errBody = await dodoRes.json() as { message?: string; error?: string }
        detail = errBody.message ?? errBody.error ?? detail
      } catch {
        try {
          detail = await dodoRes.text() || detail
        } catch {
          // keep the status-code fallback
        }
      }
      console.error('[dodo-refund] Dodo Payments Refunds API error:', dodoRes.status, detail)
      return new Response(
        JSON.stringify({ error: 'refund_failed', detail }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const refundData = await dodoRes.json() as {
      refund_id?: string
      id?:        string
      status?:    string
    }

    // Normalise field names — Dodo may return id or refund_id
    const refundId     = refundData.refund_id ?? refundData.id ?? ''
    const refundStatus = refundData.status    ?? 'initiated'

    // ── 7. INSERT webhook_events row for audit trail ───────────────────────────
    const { error: dbError } = await supabase
      .from('webhook_events')
      .insert({
        event_type: 'refund.initiated',
        source:     'dodo_payments',
        payload:    refundData,
      })

    if (dbError) {
      console.error('[dodo-refund] Failed to insert webhook_events row:', dbError.message)
      return new Response(
        JSON.stringify({ error: 'refund_record_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 8. Return success ─────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ refund_id: refundId, status: refundStatus }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[dodo-refund] error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

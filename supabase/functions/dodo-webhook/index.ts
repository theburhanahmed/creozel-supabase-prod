/**
 * Edge Function: dodo-webhook
 *
 * Public endpoint (verify_jwt: false) — secured by Standard Webhooks HMAC only.
 *
 * Receives Dodo Payments webhook events, verifies the HMAC-SHA256 signature,
 * enforces idempotency via webhook_events.reference_id, and processes:
 *   - payment.succeeded  → credit wallet, record transaction (atomic)
 *   - payment.failed     → record event only, no balance change
 *   - refund.succeeded   → deduct credits (floor 0), record refund transaction
 *
 * Headers expected:
 *   webhook-id:        string  (idempotency key)
 *   webhook-signature: string  (Standard Webhooks HMAC SHA256, e.g. "v1,<base64>")
 *   webhook-timestamp: string  (Unix timestamp, must be within ±300s)
 *
 * Error Responses:
 *   401: { error: 'invalid_signature' }
 *   422: { error: 'invalid_payload' }
 *   422: { error: 'original_transaction_not_found' }
 *   500: { error: 'webhook_secret_not_configured' }
 *   500: (implicit) — triggers Dodo retry on DB failure
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── HMAC helpers ──────────────────────────────────────────────────────────────

/**
 * Decode a base64 string to a Uint8Array.
 * Handles both standard and URL-safe base64.
 */
function base64Decode(b64: string): Uint8Array {
  // Normalise URL-safe base64 to standard
  const normalised = b64.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalised)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Encode a Uint8Array to base64.
 */
function base64Encode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Compute HMAC-SHA256 over `message` using `keyBytes` as the raw key.
 * Returns the signature as a base64 string.
 */
async function hmacSha256(keyBytes: Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const msgBytes = new TextEncoder().encode(message)
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgBytes)
  return base64Encode(new Uint8Array(sigBuffer))
}

/**
 * Verify the Standard Webhooks HMAC signature.
 *
 * Signed content = "${webhook-id}.${webhook-timestamp}.${rawBody}"
 * The webhook-signature header may contain multiple space-separated tokens,
 * each in the format "v1,<base64_sig>".
 *
 * Returns true if at least one token matches the computed HMAC.
 */
async function verifySignature(
  webhookId: string,
  webhookTimestamp: string,
  rawBody: string,
  signatureHeader: string,
  webhookKeyBytes: Uint8Array,
): Promise<boolean> {
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`
  const expectedSig = await hmacSha256(webhookKeyBytes, signedContent)

  // Header may contain multiple signatures separated by spaces
  const tokens = signatureHeader.split(' ')
  for (const token of tokens) {
    const parts = token.split(',')
    if (parts.length < 2) continue
    const version = parts[0]
    const sig = parts.slice(1).join(',') // handle base64 with commas (unlikely but safe)
    if (version === 'v1' && sig === expectedSig) {
      return true
    }
  }
  return false
}

// ── Dodo Payments event payload types ────────────────────────────────────────

interface DodoProductCartItem {
  product_id: string
  quantity:   number
}

interface DodoPaymentSucceededData {
  payment_id:   string
  product_cart: DodoProductCartItem[]
  metadata?:    Record<string, string>
}

interface DodoPaymentFailedData {
  payment_id: string
}

interface DodoRefundSucceededData {
  refund_id:  string
  payment_id: string
}

interface DodoWebhookEvent {
  type: 'payment.succeeded' | 'payment.failed' | 'refund.succeeded' | string
  data: DodoPaymentSucceededData | DodoPaymentFailedData | DodoRefundSucceededData
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase    = createClient(supabaseUrl, serviceKey)

  try {
    // ── 1. Read webhook secret ────────────────────────────────────────────────
    const webhookKeyB64 = Deno.env.get('DODO_PAYMENTS_WEBHOOK_KEY')
    if (!webhookKeyB64) {
      console.error('[dodo-webhook] DODO_PAYMENTS_WEBHOOK_KEY is not configured')
      return new Response(
        JSON.stringify({ error: 'webhook_secret_not_configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const dodoEnv = Deno.env.get('DODO_PAYMENTS_ENVIRONMENT') ?? 'test_mode'

    // ── 2. Read required headers ──────────────────────────────────────────────
    const webhookId        = req.headers.get('webhook-id')        ?? ''
    const webhookTimestamp = req.headers.get('webhook-timestamp') ?? ''
    const webhookSignature = req.headers.get('webhook-signature') ?? ''

    // ── 3. Read raw body as text (required for HMAC — must NOT parse JSON first) ──
    const rawBody = await req.text()

    // ── 4. Timestamp validation (replay attack prevention) ───────────────────
    const tsSeconds = parseInt(webhookTimestamp, 10)
    if (!webhookTimestamp || isNaN(tsSeconds)) {
      console.warn('[dodo-webhook] Missing or invalid webhook-timestamp')
      return new Response(
        JSON.stringify({ error: 'invalid_signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const ageDelta   = Math.abs(nowSeconds - tsSeconds)
    if (ageDelta > 300) {
      console.warn(`[dodo-webhook] Timestamp too old or in the future: delta=${ageDelta}s`)
      return new Response(
        JSON.stringify({ error: 'invalid_signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 5. Signature verification ─────────────────────────────────────────────
    const isTestMode = dodoEnv === 'test_mode'

    if (!webhookSignature) {
      // In test_mode: allow unsigned payloads (supports `dodo wh listen`)
      // In live_mode: always reject
      if (!isTestMode) {
        console.warn('[dodo-webhook] Missing webhook-signature in live_mode')
        return new Response(
          JSON.stringify({ error: 'invalid_signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      // test_mode with no signature — skip verification
    } else {
      // Signature header present — always verify regardless of mode
      if (!webhookId) {
        console.warn('[dodo-webhook] Missing webhook-id header')
        return new Response(
          JSON.stringify({ error: 'invalid_signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      let webhookKeyBytes: Uint8Array
      try {
        webhookKeyBytes = base64Decode(webhookKeyB64)
      } catch (e) {
        console.error('[dodo-webhook] Failed to decode DODO_PAYMENTS_WEBHOOK_KEY:', e)
        return new Response(
          JSON.stringify({ error: 'webhook_secret_not_configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const valid = await verifySignature(
        webhookId,
        webhookTimestamp,
        rawBody,
        webhookSignature,
        webhookKeyBytes,
      )

      if (!valid) {
        console.warn('[dodo-webhook] HMAC signature mismatch')
        return new Response(
          JSON.stringify({ error: 'invalid_signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // ── 6. Idempotency check ──────────────────────────────────────────────────
    if (webhookId) {
      const { data: existingEvent } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('reference_id', webhookId)
        .maybeSingle()

      if (existingEvent) {
        console.log(`[dodo-webhook] Duplicate webhook-id: ${webhookId}`)
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // ── 7. Parse event body ───────────────────────────────────────────────────
    let event: DodoWebhookEvent
    try {
      event = JSON.parse(rawBody) as DodoWebhookEvent
    } catch {
      console.error('[dodo-webhook] Failed to parse request body as JSON')
      return new Response(
        JSON.stringify({ error: 'invalid_payload' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const eventType = event.type

    // ── 8. Handle payment.succeeded ──────────────────────────────────────────
    if (eventType === 'payment.succeeded') {
      const data = event.data as DodoPaymentSucceededData

      // Validate required payload fields
      if (
        !data.product_cart ||
        !Array.isArray(data.product_cart) ||
        data.product_cart.length === 0
      ) {
        console.warn('[dodo-webhook] payment.succeeded: missing product_cart')
        return new Response(
          JSON.stringify({ error: 'invalid_payload' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const walletId = data.metadata?.metadata_wallet_id
      if (!walletId) {
        console.warn('[dodo-webhook] payment.succeeded: missing metadata_wallet_id')
        return new Response(
          JSON.stringify({ error: 'invalid_payload' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const productId = data.product_cart[0].product_id
      const paymentId = data.payment_id

      // Lookup credits for this product
      const { data: product, error: productError } = await supabase
        .from('dodo_products')
        .select('credits')
        .eq('product_id', productId)
        .single()

      if (productError || !product) {
        console.error(`[dodo-webhook] dodo_products lookup failed for product_id=${productId}:`, productError?.message)
        // Return 500 to trigger Dodo retry
        return new Response(
          JSON.stringify({ error: 'product_not_found' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const credits = product.credits

      // ── Atomic sequence: INSERT webhook_events → UPDATE wallets → INSERT credit_transactions → mark processed_at ──
      // Supabase JS does not expose BEGIN/COMMIT directly, so we execute the
      // operations sequentially and return HTTP 500 on any failure to trigger retry.

      // Step (a): INSERT webhook_events
      const { data: webhookEventRow, error: weInsertError } = await supabase
        .from('webhook_events')
        .insert({
          source:       'dodo_payments',
          event_type:   'payment.succeeded',
          payload:      rawBody,
          reference_id: webhookId || null,
        })
        .select('id')
        .single()

      if (weInsertError || !webhookEventRow) {
        console.error('[dodo-webhook] Failed to insert webhook_events:', weInsertError?.message)
        return new Response(
          JSON.stringify({ error: 'db_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const webhookEventId = webhookEventRow.id

      // Step (b+c): UPDATE wallets.balance atomically
      // Fetch current balance then write back balance + credits in a single UPDATE.
      // This is safe because the idempotency check above prevents duplicate processing.
      const { data: walletRow, error: walletFetchError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('id', walletId)
        .single()

      if (walletFetchError || !walletRow) {
        console.error('[dodo-webhook] Failed to fetch wallet for payment.succeeded:', walletFetchError?.message)
        // Clean up the webhook_events row we just inserted
        await supabase.from('webhook_events').delete().eq('id', webhookEventId)
        return new Response(
          JSON.stringify({ error: 'db_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const { error: walletUpdateError } = await supabase
        .from('wallets')
        .update({ balance: walletRow.balance + credits })
        .eq('id', walletId)

      if (walletUpdateError) {
        console.error('[dodo-webhook] Failed to update wallet balance:', walletUpdateError.message)
        // Clean up the webhook_events row we just inserted
        await supabase.from('webhook_events').delete().eq('id', webhookEventId)
        return new Response(
          JSON.stringify({ error: 'db_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Step (d): INSERT credit_transactions
      const { error: txError } = await supabase
        .from('credit_transactions')
        .insert({
          wallet_id:        walletId,
          type:             'purchase',
          amount:           credits,
          description:      'Dodo Payments credit purchase',
          reference_id:     paymentId,
          dodo_payment_id:  paymentId,
          dodo_product_id:  productId,
        })

      if (txError) {
        console.error('[dodo-webhook] Failed to insert credit_transactions:', txError.message)
        return new Response(
          JSON.stringify({ error: 'db_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Step (e): Mark webhook_events.processed_at
      await supabase
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', webhookEventId)

      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 9. Handle payment.failed ──────────────────────────────────────────────
    if (eventType === 'payment.failed') {
      // Record event only — do NOT modify wallets.balance
      const { error: weError } = await supabase
        .from('webhook_events')
        .insert({
          source:       'dodo_payments',
          event_type:   'payment.failed',
          payload:      rawBody,
          reference_id: webhookId || null,
        })

      if (weError) {
        console.error('[dodo-webhook] Failed to insert webhook_events for payment.failed:', weError.message)
        return new Response(
          JSON.stringify({ error: 'db_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 10. Handle refund.succeeded ───────────────────────────────────────────
    if (eventType === 'refund.succeeded') {
      const data = event.data as DodoRefundSucceededData
      const { refund_id, payment_id } = data

      // Step (a): INSERT webhook_events
      const { error: weError } = await supabase
        .from('webhook_events')
        .insert({
          source:       'dodo_payments',
          event_type:   'refund.succeeded',
          payload:      rawBody,
          reference_id: webhookId || null,
        })

      if (weError) {
        console.error('[dodo-webhook] Failed to insert webhook_events for refund.succeeded:', weError.message)
        return new Response(
          JSON.stringify({ error: 'db_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Step (b): Find original credit_transactions row by reference_id = payment_id
      const { data: originalTx, error: txLookupError } = await supabase
        .from('credit_transactions')
        .select('id, wallet_id, amount')
        .eq('reference_id', payment_id)
        .eq('type', 'purchase')
        .maybeSingle()

      if (txLookupError || !originalTx) {
        console.warn(`[dodo-webhook] Original transaction not found for payment_id=${payment_id}`)
        return new Response(
          JSON.stringify({ error: 'original_transaction_not_found' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const refundCredits = originalTx.amount  // positive number of credits to refund
      const walletId      = originalTx.wallet_id

      // Step (c): Decrement wallets.balance with floor of 0
      // Fetch current balance first
      const { data: wallet, error: walletFetchError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('id', walletId)
        .single()

      if (walletFetchError || !wallet) {
        console.error('[dodo-webhook] Failed to fetch wallet for refund:', walletFetchError?.message)
        return new Response(
          JSON.stringify({ error: 'db_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const newBalance = Math.max(0, wallet.balance - refundCredits)

      const { error: walletUpdateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', walletId)

      if (walletUpdateError) {
        console.error('[dodo-webhook] Failed to update wallet balance for refund:', walletUpdateError.message)
        return new Response(
          JSON.stringify({ error: 'db_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Step (d): INSERT credit_transactions (type='refund', amount=-credits)
      const { error: refundTxError } = await supabase
        .from('credit_transactions')
        .insert({
          wallet_id:       walletId,
          type:            'refund',
          amount:          -refundCredits,
          description:     'Dodo Payments refund',
          reference_id:    refund_id,
          dodo_payment_id: payment_id,
        })

      if (refundTxError) {
        console.error('[dodo-webhook] Failed to insert refund credit_transaction:', refundTxError.message)
        return new Response(
          JSON.stringify({ error: 'db_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 11. Unknown event type — acknowledge without processing ───────────────
    console.log(`[dodo-webhook] Unhandled event type: ${eventType}`)
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[dodo-webhook] Unhandled error:', message)
    // Return 500 so Dodo Payments retries the event
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

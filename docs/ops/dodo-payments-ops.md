# Dodo Payments Operations Guide

## Overview

This guide covers day-to-day operational tasks for the Dodo Payments integration: manually adding credits, processing refunds, testing with sandbox cards and UPI IDs, and forwarding test webhooks to a local development server.

All payment logic runs server-side in Supabase Edge Functions. The frontend only redirects to and from the Dodo Payments hosted checkout page.

> ⚠️ **Never use live API keys against test wallets or vice versa.** A mismatch between `DODO_PAYMENTS_ENVIRONMENT` (server) and `VITE_DODO_PAYMENTS_ENVIRONMENT` (client) causes HTTP 500 on all `create-checkout` requests until resolved.

---

## 1. Manually Adding Test Credits

Use the `manual_credit_topup` PostgreSQL function to add credits directly to any wallet without going through the payment flow. This is useful for support cases, bonuses, and local testing.

### Via Supabase RPC (service-role key required)

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/rest/v1/rpc/manual_credit_topup' \
  -H 'apikey: <service-role-key>' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "wallet_id": "<wallet-uuid>",
    "amount": 100,
    "description": "Manual test credit grant",
    "admin_user_id": "<your-admin-user-uuid>"
  }'
```

**Response (success):**
```json
200 OK
100
```
The response body is the updated wallet balance as an integer.

### Constraints

| Parameter | Constraint |
|-----------|-----------|
| `wallet_id` | Must match an existing row in `wallets` |
| `amount` | Integer between 1 and 1,000,000 inclusive |
| `description` | Free text; shown in transaction history |
| `admin_user_id` | UUID of the admin performing the action |

**Error cases:**
- `amount` outside [1, 1,000,000] → raises `'amount must be between 1 and 1000000'`
- `wallet_id` not found → raises `'wallet not found'`
- Calling without the service-role key → permission denied (function is `SECURITY DEFINER`, `EXECUTE` revoked from `public`)

### Via the Admin Top-Up Edge Function

The `admin-topup` Edge Function wraps the RPC call and is the preferred method from scripts:

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/admin-topup' \
  -H 'Authorization: Bearer <service-role-jwt>' \
  -H 'Content-Type: application/json' \
  -d '{
    "wallet_id": "<wallet-uuid>",
    "amount": 100,
    "description": "Manual test credit grant"
  }'
```

**Response (success):**
```json
{ "new_balance": 100 }
```

---

## 2. Processing a Refund

Refunds are initiated via the `dodo-refund` Edge Function, which calls the Dodo Payments Refunds API and records the event. The actual wallet balance deduction happens when Dodo Payments delivers the subsequent `refund.succeeded` webhook.

### curl Example

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/dodo-refund' \
  -H 'Authorization: Bearer <service-role-jwt>' \
  -H 'Content-Type: application/json' \
  -d '{
    "payment_id": "pay_ts2ySpzg07phGeBZqePbH",
    "reason": "Customer requested refund — duplicate purchase"
  }'
```

**Response (success):**
```json
{
  "refund_id": "ref_abc123",
  "status": "pending"
}
```

### Error Responses

| HTTP Status | Body | Cause |
|-------------|------|-------|
| 400 | `{ "error": "invalid_request" }` | Missing `payment_id`, missing `reason`, or `reason` > 500 chars |
| 403 | `{ "error": "forbidden" }` | JWT lacks service-role or admin claim |
| 502 | `{ "error": "refund_failed", "detail": "..." }` | Dodo Payments API returned an error |
| 500 | `{ "error": "refund_record_failed" }` | DB insert for `webhook_events` failed |

### Refund Flow

1. `dodo-refund` calls `POST /refunds` on the Dodo Payments API.
2. On success, it inserts a `webhook_events` row with `event_type = 'refund.initiated'`.
3. Dodo Payments later delivers a `refund.succeeded` webhook to `dodo-webhook`.
4. `dodo-webhook` decrements `wallets.balance` (floor of 0) and inserts a `credit_transactions` row with `type = 'refund'`.

> ℹ️ The wallet balance is **not** updated immediately on refund initiation — it is updated only after the `refund.succeeded` webhook is received and verified.

---

## 3. Test Cards and UPI IDs

Use these credentials in `test_mode` only. No real charges are processed.

### Test Cards

| Card Number | Behaviour |
|-------------|-----------|
| `4242 4242 4242 4242` | Payment succeeds |
| `5555 5555 5555 4444` | Payment succeeds (Mastercard) |

Use any future expiry date (e.g., `12/30`), any 3-digit CVV, and any billing name/address.

### Test UPI IDs

| UPI ID | Behaviour |
|--------|-----------|
| `success@upi` | Payment succeeds |
| `failure@upi` | Payment fails |

### Verifying Test Payments

After a successful test checkout, confirm the credit was applied:

```bash
# Check wallet balance
curl -X GET \
  'https://<project-ref>.supabase.co/rest/v1/wallets?id=eq.<wallet-uuid>&select=balance' \
  -H 'apikey: <service-role-key>' \
  -H 'Authorization: Bearer <service-role-key>'

# Check transaction history
curl -X GET \
  'https://<project-ref>.supabase.co/rest/v1/credit_transactions?wallet_id=eq.<wallet-uuid>&order=created_at.desc&limit=5' \
  -H 'apikey: <service-role-key>' \
  -H 'Authorization: Bearer <service-role-key>'
```

---

## 4. Forwarding Test Webhooks Locally (`dodo wh listen`)

The Dodo Payments CLI can forward webhook events from the Dodo dashboard to your local development server. In `test_mode`, the `dodo-webhook` Edge Function accepts payloads without a `webhook-signature` header, so local forwarding works without signing.

### Prerequisites

```bash
# Install the Dodo Payments CLI
npm install -g @dodopayments/cli

# Authenticate
dodo login
```

### Start the Local Webhook Forwarder

```bash
# Forward webhooks to your local Supabase Edge Function
dodo wh listen \
  --forward-to http://localhost:54321/functions/v1/dodo-webhook
```

The CLI will print a local webhook URL and begin forwarding all events from your Dodo test dashboard to the local endpoint.

### Running Supabase Edge Functions Locally

Start the local Supabase stack before forwarding:

```bash
# From the workspace root
npx supabase start
npx supabase functions serve
```

Edge Functions will be available at `http://localhost:54321/functions/v1/`.

### Triggering a Test Webhook

1. Complete a test checkout using one of the test cards above.
2. The Dodo dashboard sends a `payment.succeeded` event.
3. The CLI forwards it to `http://localhost:54321/functions/v1/dodo-webhook`.
4. The local `dodo-webhook` function processes it and updates the local database.

### Verifying Webhook Processing

```bash
# Check webhook_events table for the processed event
psql -h localhost -U postgres -d creozel \
  -c "SELECT id, event_type, reference_id, processed_at FROM webhook_events ORDER BY created_at DESC LIMIT 5;"
```

A `processed_at` timestamp confirms the event was handled successfully. A NULL `processed_at` with a row present indicates the event was received but processing failed.

### Signature Verification in Test Mode

In `test_mode`, the `dodo-webhook` function skips HMAC signature verification when the `webhook-signature` header is absent. This allows `dodo wh listen` to forward events without signing them.

> ⚠️ In `live_mode`, signature verification is always enforced. Ensure `DODO_PAYMENTS_ENVIRONMENT=live_mode` is set before going to production and that `DODO_PAYMENTS_WEBHOOK_KEY` matches the secret in the Dodo Payments dashboard.

---

## Environment Variables Reference

| Variable | Location | Description |
|----------|----------|-------------|
| `DODO_PAYMENTS_API_KEY` | Supabase secret (server) | API key from the Dodo Payments dashboard |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Supabase secret (server) | HMAC webhook secret from the Dodo Payments dashboard |
| `DODO_PAYMENTS_ENVIRONMENT` | Supabase secret (server) | `test_mode` or `live_mode` |
| `VITE_DODO_PAYMENTS_ENABLED` | `.env` (client) | Set to `"true"` to enable the Dodo Payments UI |
| `VITE_DODO_PAYMENTS_ENVIRONMENT` | `.env` (client) | Must match `DODO_PAYMENTS_ENVIRONMENT` |

See `.env.example` for full documentation of each variable.

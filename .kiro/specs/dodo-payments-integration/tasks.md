# Implementation Plan: Dodo Payments Integration

## Overview

Replace the Stripe `alert()` stub in `AddCredits.tsx` with a fully functional Dodo Payments credit top-up flow. The implementation proceeds in dependency order: database schema first, then Edge Functions, then frontend types/services/pages, and finally docs and config. All payment logic runs server-side in Deno Edge Functions following the `generate-content` pattern; the frontend only redirects to and from the Dodo Payments hosted checkout.

---

## Tasks

- [x] 1. Apply database migration — dodo_products, schema columns, RLS, and seed data
  - [x] 1.1 Create migration `supabase/migrations/20260514000001_dodo_payments.sql`
    - Create `dodo_products` table with columns: `id` (uuid PK), `product_id` (text, unique, not null), `label` (text, not null), `credits` (integer, not null, check > 0), `price_display` (text, not null), `is_active` (boolean, not null, default true), `is_popular` (boolean, not null, default false), `created_at` (timestamptz, not null, default now())
    - Seed three rows: Starter Pack (`prod_starter_100`, 100 credits, `$4.99`), Creator Pack (`prod_creator_500`, 500 credits, `$19.99`, `is_popular = true`), Pro Pack (`prod_pro_1500`, 1500 credits, `$49.99`)
    - Enable RLS on `dodo_products`; add policy allowing authenticated users to SELECT rows where `is_active = true`; restrict INSERT/UPDATE/DELETE to service-role only
    - Add nullable `dodo_payment_id text` and `dodo_product_id text` columns to `credit_transactions`
    - Add nullable `source text` and `reference_id varchar(255)` columns to `webhook_events`; create UNIQUE index `webhook_events_reference_id_idx` on `(reference_id) WHERE reference_id IS NOT NULL`
    - _Requirements: 2.1, 2.2, 2.6, 2.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
    - _Design: Data Models — dodo_products, Schema Updates_

  - [ ]* 1.2 Write unit test for migration seed data
    - Assert `dodo_products` contains exactly 3 rows after migration
    - Assert each row has correct `product_id`, `credits`, `price_display`, and `is_popular` values
    - _Requirements: 2.2, 8.8_

- [x] 2. Apply database migration — `manual_credit_topup` DB function
  - [x] 2.1 Create migration `supabase/migrations/20260514000002_manual_topup_fn.sql`
    - Implement `public.manual_credit_topup(wallet_id uuid, amount integer, description text, admin_user_id uuid) RETURNS integer` as `SECURITY DEFINER` with `search_path = public`
    - Validate `amount` is between 1 and 1,000,000; raise exception `'amount must be between 1 and 1000000'` otherwise
    - Atomically `UPDATE wallets SET balance = balance + amount WHERE id = wallet_id RETURNING balance`; raise exception `'wallet not found'` if no row matched
    - Insert `credit_transactions` row with `type = 'bonus'`, `amount = amount`, `description = description`
    - Return updated balance
    - `REVOKE EXECUTE ON FUNCTION public.manual_credit_topup FROM public`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
    - _Design: DB Function — manual_credit_topup_

  - [ ]* 2.2 Write property test for manual top-up arithmetic
    - **Property 6: Manual Top-Up Arithmetic**
    - **Validates: Requirements 5.1, 10.5**
    - File: `frontend/src/__tests__/pbt/manualTopup.pbt.test.ts`
    - For any wallet balance `B` and any `amount` in [1, 1_000_000], assert `manual_credit_topup` returns `B + amount` and the stored balance equals `B + amount`
    - Run minimum 100 iterations with fast-check

- [x] 3. Checkpoint — Ensure migrations apply cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement `create-checkout` Edge Function
  - [x] 4.1 Create `supabase/functions/create-checkout/index.ts`
    - Follow the `generate-content` pattern: `serve()`, `corsHeaders`, service-role `createClient`, `try/catch` with error reporting
    - Read `DODO_PAYMENTS_API_KEY` and `DODO_PAYMENTS_ENVIRONMENT` (default `test_mode`) from `Deno.env`; return HTTP 500 `{ error: 'payment_provider_not_configured' }` if API key is absent
    - Validate JWT via `supabase.auth.getUser(jwt)`; return HTTP 401 `{ error: 'unauthorized' }` if invalid
    - Parse and validate request body `{ product_id, user_id, wallet_id }`; return HTTP 400 `{ error: 'invalid_request' }` if any field is absent, null, or empty string
    - Fetch `customer.email` from `profiles` table using `user_id`
    - POST to Dodo Payments Checkout Sessions API with `product_cart: [{ product_id, quantity: 1 }]`, `customer.email`, `return_url = {FRONTEND_URL}/credits/add?status=success`, `metadata_wallet_id = wallet_id`, and `environment`
    - Return HTTP 502 `{ error: 'checkout_creation_failed' }` on Dodo API error
    - Return HTTP 200 `{ checkout_url, payment_id }` on success
    - _Requirements: 1.1, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2_
    - _Design: Edge Function Interfaces — create-checkout_

  - [ ]* 4.2 Write property test for checkout input validation
    - **Property 7: Checkout Input Validation**
    - **Property 8: Checkout URL Is a Valid HTTPS URL**
    - **Validates: Requirements 3.2, 10.6**
    - File: `frontend/src/__tests__/pbt/checkoutValidation.pbt.test.ts`
    - For any request body missing at least one of `product_id`, `user_id`, `wallet_id` (or any field is empty string), assert the function returns HTTP 400 and does NOT call the Dodo API
    - For any valid `product_id` matching an existing row, assert `checkout_url` starts with `https://`
    - Run minimum 100 iterations with fast-check

  - [ ]* 4.3 Write unit tests for `create-checkout`
    - Test: returns HTTP 500 when `DODO_PAYMENTS_API_KEY` is absent (SMOKE)
    - Test: returns HTTP 401 when JWT is missing or invalid
    - Test: returns HTTP 502 when Dodo Payments API returns an error response
    - File: `supabase/functions/create-checkout/index.test.ts`
    - _Requirements: 1.6, 3.4, 3.5_

- [x] 5. Implement `dodo-webhook` Edge Function
  - [x] 5.1 Create `supabase/functions/dodo-webhook/index.ts` (deploy with `verify_jwt: false`)
    - Follow the `generate-content` pattern; read `DODO_PAYMENTS_WEBHOOK_KEY` from `Deno.env`; return HTTP 500 `{ error: 'webhook_secret_not_configured' }` if absent
    - Read raw request body as text (required for HMAC); do NOT parse JSON before signature check
    - Verify Standard Webhooks HMAC: construct `"${webhook-id}.${webhook-timestamp}.${rawBody}"`, compute `HMAC-SHA256` with `base64_decode(DODO_PAYMENTS_WEBHOOK_KEY)`, compare against each `v1,<sig>` in `webhook-signature` header
    - Reject if timestamp is more than 300 seconds old or in the future; return HTTP 401 `{ error: 'invalid_signature' }` on any failure
    - In `test_mode`: skip signature check when `webhook-signature` header is absent; in `live_mode`: always enforce
    - Check `webhook_events` for existing row with `reference_id = webhook-id`; return HTTP 200 `{ received: true, duplicate: true }` if found
    - Handle `payment.succeeded`: execute atomically — INSERT `webhook_events`, lookup `dodo_products` credits, UPDATE `wallets.balance`, INSERT `credit_transactions (type='purchase')`, mark `webhook_events.processed_at`; return HTTP 500 on DB failure (triggers Dodo retry)
    - Handle `payment.failed`: INSERT `webhook_events` row only; do NOT modify `wallets.balance`
    - Handle `refund.succeeded`: INSERT `webhook_events`, find original `credit_transactions` by `reference_id = payment_id` (return HTTP 422 `{ error: 'original_transaction_not_found' }` if missing), decrement `wallets.balance` with floor of 0, INSERT `credit_transactions (type='refund', amount=-credits)`
    - Return HTTP 422 `{ error: 'invalid_payload' }` for missing `product_cart` or `metadata_wallet_id`
    - _Requirements: 1.2, 1.7, 4.1–4.10, 7.5, 7.6, 8.3–8.6_
    - _Design: Edge Function Interfaces — dodo-webhook, Webhook Flow_

  - [ ]* 5.2 Write property test for signature verification
    - **Property 1: Signature Verification Rejects Tampered Payloads**
    - **Validates: Requirements 4.2, 4.3, 10.7**
    - File: `frontend/src/__tests__/pbt/dodoPaymentsSignature.pbt.test.ts`
    - For any payload and HMAC key, assert that a tampered body, wrong key, or absent header (in live mode) returns HTTP 401 and inserts no `webhook_events` rows
    - Run minimum 100 iterations with fast-check

  - [ ]* 5.3 Write property test for idempotency
    - **Property 2: Idempotency — Duplicate Webhook-ID Is a No-Op**
    - **Validates: Requirements 4.4, 10.2**
    - File: `frontend/src/__tests__/pbt/dodoPaymentsIdempotency.pbt.test.ts`
    - For any `webhook-id` already present in `webhook_events.reference_id`, assert second submission returns HTTP 200 `{ received: true, duplicate: true }` and does NOT insert additional `credit_transactions` rows or modify `wallets.balance`
    - Run minimum 100 iterations with fast-check

  - [ ]* 5.4 Write property test for payment processing correctness
    - **Property 3: Payment Processing Correctness**
    - **Property 4: Refund Net Balance**
    - **Property 5: Balance Floor at Zero**
    - **Validates: Requirements 4.5, 4.7, 10.1, 10.3, 10.4**
    - File: `frontend/src/__tests__/pbt/dodoPaymentsProcessing.pbt.test.ts`
    - For any valid `payment.succeeded` payload with `credits_purchased > 0`, assert `wallets.balance` increments by exactly `credits_purchased` and exactly one `credit_transactions` row of `type='purchase'` is inserted
    - For any `payment.succeeded` followed by `refund.succeeded`, assert net balance change equals `credits_purchased - credits_refunded`
    - For any refund where `credits_refunded > current_balance`, assert `wallets.balance` is set to 0 and never goes negative
    - Run minimum 100 iterations with fast-check

  - [ ]* 5.5 Write unit tests for `dodo-webhook`
    - Test: returns HTTP 500 when `DODO_PAYMENTS_WEBHOOK_KEY` is absent (SMOKE)
    - Test: `payment.failed` inserts `webhook_events` row but does NOT modify `wallets.balance`
    - Test: `refund.succeeded` with no matching `credit_transactions` row returns HTTP 422
    - File: `supabase/functions/dodo-webhook/index.test.ts`
    - _Requirements: 1.7, 4.6, 4.7_

- [x] 6. Implement `dodo-refund` Edge Function
  - [x] 6.1 Create `supabase/functions/dodo-refund/index.ts`
    - Follow the `generate-content` pattern; read `DODO_PAYMENTS_API_KEY` from `Deno.env`
    - Validate JWT and check for service-role or admin claim; return HTTP 403 `{ error: 'forbidden' }` if absent or unauthorized
    - Parse and validate `{ payment_id, reason }`; return HTTP 400 `{ error: 'invalid_request' }` if `payment_id` is missing, `reason` is missing, or `reason` exceeds 500 characters
    - POST to Dodo Payments Refunds API (`POST /refunds`) with `payment_id` and `reason`; return HTTP 502 `{ error: 'refund_failed', detail: <dodo_error_message> }` on API error
    - INSERT `webhook_events` row with `event_type = 'refund.initiated'` and `payload` containing the refund response; return HTTP 500 `{ error: 'refund_record_failed' }` if DB insert fails
    - Return HTTP 200 `{ refund_id, status }` on success
    - _Requirements: 1.3, 6.1–6.5_
    - _Design: Edge Function Interfaces — dodo-refund, Refund Flow_

  - [ ]* 6.2 Write unit tests for `dodo-refund`
    - Test: returns HTTP 403 when JWT lacks service-role/admin claim
    - Test: returns HTTP 400 when `reason` exceeds 500 characters
    - Test: returns HTTP 502 when Dodo Payments Refunds API returns an error
    - File: `supabase/functions/dodo-refund/index.test.ts`
    - _Requirements: 6.2, 6.3, 6.5_

- [x] 7. Implement `admin-topup` Edge Function
  - [x] 7.1 Create `supabase/functions/admin-topup/index.ts`
    - Follow the `generate-content` pattern; validate JWT for service-role claim; return HTTP 401 `{ error: 'unauthorized' }` on any failure
    - Parse `{ amount, description }` from request body
    - Call `supabase.rpc('manual_credit_topup', { wallet_id, amount, description, admin_user_id })` using the service-role client
    - Return HTTP 500 `{ error: 'topup_failed' }` on DB error
    - Return HTTP 200 `{ new_balance: number }` on success
    - _Requirements: 5.5, 5.7, 5.8, 5.9_
    - _Design: Edge Function Interfaces — admin-topup_

  - [ ]* 7.2 Write unit tests for `admin-topup`
    - Test: returns HTTP 401 when JWT is absent or invalid
    - Test: returns HTTP 500 `{ error: 'topup_failed' }` when `manual_credit_topup` raises an exception
    - File: `supabase/functions/admin-topup/index.test.ts`
    - _Requirements: 5.7, 5.8_

- [x] 8. Checkpoint — Ensure all Edge Functions are wired and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Add `DodoProduct` interface to frontend types
  - [x] 9.1 Add `DodoProduct` interface to `frontend/src/types/index.ts`
    - Export `DodoProduct` interface with fields: `id: string`, `product_id: string`, `label: string`, `credits: number`, `price_display: string`, `is_active: boolean`, `is_popular: boolean`
    - Place in the `Credits & Billing` section alongside `Wallet` and `CreditTransaction`
    - _Requirements: 9.8_
    - _Design: Frontend Component Interfaces — DodoProduct_

- [x] 10. Add `getCreditPacks()` to `creditsService.ts`
  - [x] 10.1 Add `getCreditPacks()` export to `frontend/src/services/creditsService.ts`
    - Query `supabase.from('dodo_products').select('*').eq('is_active', true).order('credits', { ascending: true })`
    - Filter returned rows: exclude any where `credits <= 0` or `product_id` is an empty string
    - On error: call `reportError('creditsService.getCreditPacks', error)` and return `[]`
    - Use `catch (error: unknown)` pattern consistent with existing `getWallet` and `getTransactions`
    - Return `DodoProduct[]`
    - _Requirements: 2.3, 9.7, 9.9_
    - _Design: Frontend Component Interfaces — getCreditPacks_

  - [ ]* 10.2 Write property test for `getCreditPacks` filtering
    - **Property 9: getCreditPacks Filters Invalid Rows**
    - **Property 10: getCreditPacks Renders Correct Pack Count**
    - **Validates: Requirements 2.3, 9.2, 10.8**
    - File: `frontend/src/__tests__/pbt/getCreditPacks.pbt.test.ts`
    - For any array of `DodoProduct` objects (including rows with `credits <= 0` or empty `product_id`), assert `getCreditPacks()` returns only elements where `credits > 0` and `product_id` is non-empty
    - For any non-empty valid array, assert `AddCredits` renders exactly that many pack cards
    - Run minimum 100 iterations with fast-check

- [x] 11. Rewrite `AddCredits.tsx`
  - [x] 11.1 Rewrite `frontend/src/pages/credits/AddCredits.tsx`
    - Remove all Stripe references, hardcoded `PLANS` array, and all `window.alert()` calls
    - Implement `AddCreditsState` shape: `packs: DodoProduct[]`, `packsLoading: boolean`, `wallet: Wallet | null`, `purchaseState: PurchaseState`, `purchasingId: string | null`
    - On mount: call `getCreditPacks()` and `getWallet(user.id)` in parallel; show exactly 3 loading skeleton cards while `packsLoading` is true
    - When `getCreditPacks()` returns empty array: display "No credit packs available. Please check back later."
    - When `getCreditPacks()` returns non-empty array: render one card per pack with `label`, `price_display`, `credits`, and `is_popular` badge
    - Read `VITE_DODO_PAYMENTS_ENABLED`; when absent or not `"true"`, show non-dismissible inline configuration warning and disable all purchase buttons
    - Show yellow "Sandbox Mode" badge in page header when `VITE_DODO_PAYMENTS_ENVIRONMENT === 'test_mode'`
    - On "Purchase" click: disable all buttons, show spinner on clicked button, invoke `supabase.functions.invoke('create-checkout', { body: { product_id, user_id, wallet_id } })` with 10-second timeout; on success redirect `window.location.href` to `checkout_url`; on error show toast "Failed to start checkout. Please try again." and re-enable buttons
    - Detect `?status=success` on mount: show success toast "Payment received! Credits will be added to your account shortly." and re-fetch wallet balance
    - Detect `?status=cancelled` on mount: show informational toast "Checkout cancelled. No charges were made."
    - Show "Test: Add 100 Credits" button when `VITE_DODO_PAYMENTS_ENVIRONMENT === 'test_mode'`; on click invoke `admin-topup` with `{ amount: 100, description: 'Test credit grant' }` and re-fetch wallet on success
    - All `catch` blocks use `catch (error: unknown)` with `reportError`
    - _Requirements: 1.4, 2.3, 2.4, 2.5, 3.6, 3.7, 3.8, 3.9, 3.10, 5.5, 5.6, 7.4, 9.1–9.6, 9.9, 9.10_
    - _Design: Frontend Component Interfaces — AddCreditsState, Checkout Flow_

  - [ ]* 11.2 Write unit tests for `AddCredits.tsx`
    - Test: shows 3 loading skeleton cards while `getCreditPacks()` is in progress
    - Test: shows "No credit packs available." when `getCreditPacks()` returns `[]`
    - Test: shows success toast on `?status=success` URL param
    - Test: shows cancelled toast on `?status=cancelled` URL param
    - _Requirements: 9.1, 9.3, 3.9, 3.10_

- [x] 12. Update `TransactionHistory.tsx` with refund badge
  - [x] 12.1 Update `frontend/src/pages/credits/TransactionHistory.tsx`
    - Ensure `TYPE_STYLES` map includes `refund` with a red badge style (already present; verify it renders the amount with a leading minus sign for negative amounts)
    - Format `created_at` as `YYYY-MM-DD HH:MM:SS` in the user's local timezone for all transaction rows
    - Ensure refund rows display the `description` field
    - _Requirements: 6.6, 6.7_
    - _Design: File Structure — TransactionHistory.tsx_

- [x] 13. Update `.env.example` with Dodo Payments variables
  - [x] 13.1 Update `.env.example` in the workspace root
    - Add a `# Dodo Payments` section with the following variables and comments:
      - `DODO_PAYMENTS_API_KEY=` — server-side API key from Dodo Payments dashboard
      - `DODO_PAYMENTS_WEBHOOK_KEY=` — HMAC webhook secret from Dodo Payments dashboard
      - `DODO_PAYMENTS_ENVIRONMENT=test_mode` — `test_mode` or `live_mode`
      - `VITE_DODO_PAYMENTS_ENABLED=true` — set to `true` to enable the Dodo Payments UI
      - `VITE_DODO_PAYMENTS_ENVIRONMENT=test_mode` — must match `DODO_PAYMENTS_ENVIRONMENT`
    - Include inline comments explaining test vs live mode and the consequence of a mismatch
    - _Requirements: 7.7_

- [x] 14. Create `docs/ops/dodo-payments-ops.md`
  - [x] 14.1 Create `docs/ops/dodo-payments-ops.md`
    - Document how to add test credits manually using `manual_credit_topup` via Supabase RPC with the service-role key
    - Document how to process a refund using the `dodo-refund` Edge Function (curl example with service-role JWT)
    - Document Dodo Payments test cards: `4242424242424242`, `5555555555554444`; test UPI IDs: `success@upi`, `failure@upi`
    - Document how to use the Dodo Payments CLI (`dodo wh listen`) to forward test webhooks to a local development server
    - _Requirements: 7.8_

- [x] 15. Final checkpoint — Ensure all tests pass and TypeScript compiles cleanly
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npx tsc --noEmit` from `frontend/` and confirm exit code 0 with no errors in `AddCredits.tsx`, `creditsService.ts`, or any new type definitions.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Migrations must be applied in order: `20260514000001` before `20260514000002`
- `dodo-webhook` must be deployed with `verify_jwt: false` — it is a public endpoint secured by HMAC only
- All Edge Functions follow the `generate-content` pattern: `serve()`, `corsHeaders`, service-role `createClient`, `try/catch`
- PBT files live in `frontend/src/__tests__/pbt/` and use fast-check (already installed)
- `DODO_PAYMENTS_ENVIRONMENT` (server) and `VITE_DODO_PAYMENTS_ENVIRONMENT` (client) must match; a mismatch causes HTTP 500 on all `create-checkout` requests
- In `test_mode`, the webhook handler accepts payloads without a `webhook-signature` header to support `dodo wh listen` local development

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1", "9.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1", "10.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5", "6.1", "7.1", "10.2"] },
    { "id": 5, "tasks": ["6.2", "7.2", "11.1"] },
    { "id": 6, "tasks": ["11.2", "12.1", "13.1", "14.1"] }
  ]
}
```

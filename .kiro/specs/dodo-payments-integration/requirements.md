# Requirements Document

## Introduction

This document defines the requirements for integrating Dodo Payments as the payment provider for Creozel's credit top-up system. The integration covers the complete payment lifecycle: checkout session creation, webhook processing, credit top-ups, refunds, and sandbox/test tooling. Dodo Payments replaces the existing Stripe `alert()` stub in `AddCredits.tsx` and becomes the canonical payment provider for one-time credit purchases.

The integration is built on top of the existing `wallets` and `credit_transactions` tables, the `reserve_credits` / `deduct_credits` / `release_credits` database functions, and the Supabase Edge Function pattern already established by `generate-content` and `oauth-connect`. All payment logic runs server-side in Deno Edge Functions; the frontend only redirects to and from the Dodo Payments hosted checkout.

---

## Glossary

- **Dodo_Payments**: The third-party payment provider at `dodopayments.com` used for processing credit purchases.
- **Checkout_Session**: A server-side session created via the Dodo Payments API that returns a `checkout_url` for redirecting the user to the hosted payment page.
- **Webhook_Handler**: The `dodo-webhook` Supabase Edge Function that receives and verifies signed event payloads from Dodo Payments.
- **Webhook_Secret**: The HMAC secret key from the Dodo Payments dashboard, stored as a Supabase secret, used to verify incoming webhook signatures via the Standard Webhooks spec.
- **Payment_ID**: The unique identifier returned by Dodo Payments for a completed payment (e.g., `pay_ts2ySpzg07phGeBZqePbH`).
- **Product_ID**: The Dodo Payments product identifier created in the dashboard for each credit pack (e.g., `prod_starter_100`).
- **AddCredits**: The React page at `frontend/src/pages/credits/AddCredits.tsx` where users select and purchase credit packs.
- **creditsService**: The service at `frontend/src/services/creditsService.ts` that wraps all Supabase calls for wallet and transaction data.
- **create-checkout**: The Supabase Edge Function that creates a Dodo Payments Checkout Session and returns the `checkout_url`.
- **dodo-webhook**: The Supabase Edge Function that receives Dodo Payments webhook events, verifies signatures, and updates the database.
- **dodo-refund**: The Supabase Edge Function that initiates a refund via the Dodo Payments API and records the reversal in `credit_transactions`.
- **Wallet**: A row in the `wallets` table representing a user's or team's credit balance.
- **Credit_Transaction**: A row in the `credit_transactions` table recording a credit movement of type `purchase`, `deduction`, `refund`, or `bonus`.
- **Test_Mode**: Dodo Payments sandbox environment accessed via `https://test.dodopayments.com` using test API keys; no real charges are processed.
- **Live_Mode**: Dodo Payments production environment accessed via `https://live.dodopayments.com` using live API keys.
- **Standard_Webhooks**: The open specification at `standardwebhooks.com` that Dodo Payments follows for HMAC SHA256 webhook signature verification.
- **Idempotency_Key**: A unique identifier (the `webhook-id` header) used to prevent duplicate processing of the same webhook event.

---

## Requirements

### Requirement 1 — Environment Configuration

**User Story:** As a platform engineer, I want all Dodo Payments credentials stored as Supabase secrets and environment variables, so that no API keys are ever exposed in source code or the frontend bundle.

#### Acceptance Criteria

1. THE `create-checkout` Edge Function SHALL read `DODO_PAYMENTS_API_KEY` from Deno environment variables and use it as the bearer token for all Dodo Payments API calls.
2. WHEN the `dodo-webhook` Edge Function is invoked, THE function SHALL read `DODO_PAYMENTS_WEBHOOK_KEY` from Deno environment variables and use it exclusively for webhook signature verification.
3. WHEN the `dodo-refund` Edge Function makes a call to the Dodo Payments API, THE function SHALL read `DODO_PAYMENTS_API_KEY` from Deno environment variables.
4. THE `AddCredits` page SHALL read `VITE_DODO_PAYMENTS_ENABLED` from the Vite environment; WHEN this variable is absent or set to any value other than `"true"`, THE `AddCredits` page SHALL display a non-dismissible inline configuration warning within the page body and disable all purchase buttons.
5. THE `create-checkout` Edge Function SHALL accept an `environment` parameter of `test_mode` or `live_mode` and pass it to the Dodo Payments SDK; WHEN `DODO_PAYMENTS_ENVIRONMENT` is not set, THE function SHALL default to `test_mode`.
6. IF `DODO_PAYMENTS_API_KEY` is absent at Edge Function invocation time, THEN THE `create-checkout` Edge Function SHALL return HTTP 500 with `{ error: 'payment_provider_not_configured' }` and SHALL NOT call the Dodo Payments API.
7. IF `DODO_PAYMENTS_WEBHOOK_KEY` is absent at `dodo-webhook` invocation time, THEN THE `dodo-webhook` Edge Function SHALL return HTTP 500 with `{ error: 'webhook_secret_not_configured' }` and SHALL NOT process the request body.

---

### Requirement 2 — Credit Pack Products

**User Story:** As a platform admin, I want credit pack definitions stored in the database and linked to Dodo Payments product IDs, so that pricing is managed in one place and the frontend always reflects the current packs.

#### Acceptance Criteria

1. THE Database SHALL contain a `dodo_products` table with the following columns and constraints: `id` (uuid, primary key, default gen_random_uuid()), `product_id` (text, unique, not null), `label` (text, not null), `credits` (integer, not null, must be greater than 0), `price_display` (text, not null), `is_active` (boolean, not null, default true), `is_popular` (boolean, not null, default false), `created_at` (timestamptz, not null, default now()).
2. THE Database SHALL seed `dodo_products` with three default rows: Starter Pack (`product_id = 'prod_starter_100'`, 100 credits, `price_display = '$4.99'`), Creator Pack (`product_id = 'prod_creator_500'`, 500 credits, `is_popular = true`, `price_display = '$19.99'`), and Pro Pack (`product_id = 'prod_pro_1500'`, 1500 credits, `price_display = '$49.99'`).
3. WHEN `creditsService.getCreditPacks()` returns a non-empty array, THE `AddCredits` page SHALL render those packs on mount.
4. IF `creditsService.getCreditPacks()` returns an empty array due to a fetch error, THEN THE `AddCredits` page SHALL fall back to a hardcoded default `PLANS` array so the UI remains functional.
5. IF `creditsService.getCreditPacks()` returns an empty array because the table contains no active rows, THEN THE `AddCredits` page SHALL display the message: "No credit packs available. Please check back later."
6. THE Database SHALL enable RLS on `dodo_products` and allow all authenticated users to SELECT rows where `is_active = true`.
7. THE Database SHALL restrict INSERT, UPDATE, and DELETE on `dodo_products` to service-role callers only.

---

### Requirement 3 — Checkout Session Creation

**User Story:** As a user, I want clicking "Purchase" to redirect me to a secure Dodo Payments hosted checkout page, so that I can complete my credit purchase without entering payment details on Creozel's servers.

#### Acceptance Criteria

1. WHEN the `create-checkout` Edge Function is invoked with a valid request body `{ product_id: string, user_id: string, wallet_id: string }`, THE function SHALL return `{ checkout_url: string, payment_id: string }`.
2. IF the request body is missing `product_id`, `user_id`, or `wallet_id`, or any field is not a non-empty string, THEN THE `create-checkout` Edge Function SHALL return HTTP 400 with `{ error: 'invalid_request' }` and SHALL NOT call the Dodo Payments API.
3. WHEN the `create-checkout` Edge Function is invoked, THE function SHALL call the Dodo Payments Checkout Sessions API with `product_cart: [{ product_id, quantity: 1 }]`, `customer.email` from the authenticated user's profile, `return_url` pointing to `{FRONTEND_URL}/credits/add?status=success`, and `metadata_wallet_id` set to the user's `wallet_id`.
4. THE `create-checkout` Edge Function SHALL require a valid Supabase JWT in the `Authorization` header; IF the JWT is absent or invalid, THEN THE function SHALL return HTTP 401 with `{ error: 'unauthorized' }`.
5. IF the Dodo Payments API returns an error response, THEN THE `create-checkout` Edge Function SHALL return HTTP 502 with `{ error: 'checkout_creation_failed' }`.
6. WHEN the user clicks "Purchase" on a credit pack, THE `AddCredits` page SHALL invoke `supabase.functions.invoke('create-checkout', { body: { product_id, user_id, wallet_id } })` and redirect `window.location.href` to the returned `checkout_url`.
7. IF `create-checkout` returns an error, times out after 10 seconds, or returns no `checkout_url`, THEN THE `AddCredits` page SHALL display a toast error: "Failed to start checkout. Please try again." and SHALL NOT redirect.
8. THE `AddCredits` page SHALL NOT call `window.alert()` for any user-facing interaction.
9. WHEN the user returns to `{FRONTEND_URL}/credits/add?status=success`, THE `AddCredits` page SHALL display a success toast: "Payment received! Credits will be added to your account shortly." and SHALL re-fetch the wallet balance from the server to update the displayed balance.
10. WHEN the user returns to `{FRONTEND_URL}/credits/add?status=cancelled`, THE `AddCredits` page SHALL display an informational toast: "Checkout cancelled. No charges were made."

---

### Requirement 4 — Webhook Processing

**User Story:** As a platform engineer, I want Dodo Payments webhook events verified and processed atomically, so that credit balances are updated exactly once per successful payment and no fraudulent events can inflate balances.

#### Acceptance Criteria

1. THE `dodo-webhook` Edge Function SHALL expose a public HTTP POST endpoint (JWT verification disabled) at `/functions/v1/dodo-webhook`.
2. WHEN a webhook request is received, THE `dodo-webhook` Edge Function SHALL verify the HMAC SHA256 signature using the `webhook-id`, `webhook-signature`, and `webhook-timestamp` headers against `DODO_PAYMENTS_WEBHOOK_KEY` following the Standard Webhooks specification; THE function SHALL reject requests where the `webhook-timestamp` is more than 300 seconds in the past or future.
3. IF signature verification fails (absent header, unparseable signature, or wrong HMAC), THEN THE `dodo-webhook` Edge Function SHALL return HTTP 401 with `{ error: 'invalid_signature' }` and SHALL NOT modify any database rows.
4. WHEN a webhook request passes signature verification, THE `dodo-webhook` Edge Function SHALL check the `webhook_events` table for an existing row with `reference_id` equal to the `webhook-id` header value; IF a matching row exists, THEN THE function SHALL return HTTP 200 with `{ received: true, duplicate: true }` without re-processing.
5. WHEN a `payment.succeeded` event is received and passes the idempotency check, THE `dodo-webhook` Edge Function SHALL execute the following steps atomically within a single database transaction: (a) insert a row into `webhook_events` with `source = 'dodo_payments'`, `event_type = 'payment.succeeded'`, `payload = raw body`, `reference_id = webhook-id`; (b) extract `wallet_id` from `data.metadata.metadata_wallet_id`; (c) extract `credits` by looking up `dodo_products` where `product_id = data.product_cart[0].product_id`; (d) increment `wallets.balance` by `credits` using a single atomic UPDATE; (e) insert a `credit_transactions` row with `type = 'purchase'`, `amount = credits`, `description = 'Dodo Payments credit purchase'`, `reference_id = data.payment_id`; (f) mark the `webhook_events` row `processed_at = now()`.
6. WHEN a `payment.failed` event is received, THE `dodo-webhook` Edge Function SHALL insert a `webhook_events` row with `event_type = 'payment.failed'` and SHALL NOT modify `wallets.balance`.
7. WHEN a `refund.succeeded` event is received, THE `dodo-webhook` Edge Function SHALL: (a) insert a `webhook_events` row; (b) find the original `credit_transactions` row by `reference_id = data.payment_id`; IF no matching row is found, THE function SHALL return HTTP 422 with `{ error: 'original_transaction_not_found' }`; (c) decrement `wallets.balance` by the refunded credit amount, with a floor of 0; (d) insert a `credit_transactions` row with `type = 'refund'`, `amount = -(refunded_credits)`, `description = 'Dodo Payments refund'`, `reference_id = data.refund_id`.
8. THE `dodo-webhook` Edge Function SHALL return HTTP 200 only after all database writes are committed; the total response time SHALL be within 5 seconds.
9. IF any database write fails during `payment.succeeded` processing, THEN THE `dodo-webhook` Edge Function SHALL roll back all writes in the transaction and return HTTP 500 so that Dodo Payments retries the event.
10. IF a `payment.succeeded` event arrives with a missing or empty `product_cart`, or with a missing `metadata_wallet_id`, THEN THE `dodo-webhook` Edge Function SHALL return HTTP 422 with `{ error: 'invalid_payload' }` and SHALL NOT modify any database rows.

---

### Requirement 5 — Credit Top-Up (Manual Admin Tool)

**User Story:** As a platform admin, I want to manually add credits to any user's wallet, so that I can handle support cases, grant bonuses, and test the credit system without going through the payment flow.

#### Acceptance Criteria

1. THE Database SHALL provide a `manual_credit_topup(wallet_id uuid, amount integer, description text, admin_user_id uuid)` PostgreSQL function that: (a) validates `amount` is between 1 and 1,000,000 inclusive; (b) increments `wallets.balance` by `amount` atomically; (c) inserts a `credit_transactions` row with `type = 'bonus'`, `amount = amount`, `description = description`; (d) returns the updated `wallets.balance`.
2. IF `amount <= 0` or `amount > 1,000,000` is passed to `manual_credit_topup`, THEN THE function SHALL raise an exception with message `'amount must be between 1 and 1000000'`.
3. IF `wallet_id` does not match any row in the `wallets` table, THEN THE `manual_credit_topup` function SHALL raise an exception with message `'wallet not found'`.
4. THE `manual_credit_topup` function SHALL be callable only by service-role callers (SECURITY DEFINER with `search_path = public`).
5. THE `AddCredits` page SHALL display a "Test: Add 100 Credits" button WHEN `VITE_DODO_PAYMENTS_ENVIRONMENT` equals `test_mode`; WHEN clicked, THE button SHALL invoke `supabase.functions.invoke('admin-topup', { body: { amount: 100, description: 'Test credit grant' } })`.
6. WHEN the `admin-topup` Edge Function returns a success response, THE `AddCredits` page SHALL re-fetch and display the updated wallet balance.
7. THE `admin-topup` Edge Function SHALL require a valid Supabase JWT with a service-role claim; IF the JWT is absent, invalid, or lacks the service-role claim, THEN THE function SHALL return HTTP 401.
8. IF `manual_credit_topup` fails due to a database error, THEN THE `admin-topup` Edge Function SHALL return HTTP 500 with `{ error: 'topup_failed' }`.
9. WHEN the `admin-topup` Edge Function returns a success response, THE response body SHALL contain `{ new_balance: number }` reflecting the updated wallet balance.

---

### Requirement 6 — Refunds

**User Story:** As a platform admin, I want to initiate refunds for credit purchases via the Dodo Payments API, so that customers who request refunds have their payment reversed and their credit balance corrected.

#### Acceptance Criteria

1. THE `dodo-refund` Edge Function SHALL accept a JSON request body containing `{ payment_id: string, reason: string }` where `reason` is between 1 and 500 characters, and call the Dodo Payments Refunds API (`POST /refunds`) with `payment_id` and `reason`.
2. IF the request body is missing `payment_id` or `reason`, or `reason` exceeds 500 characters, THEN THE `dodo-refund` Edge Function SHALL return HTTP 400 with `{ error: 'invalid_request' }` and SHALL NOT call the Dodo Payments API.
3. THE `dodo-refund` Edge Function SHALL require a valid Supabase JWT with a service-role or admin claim; IF the JWT is absent, expired, or lacks the required claim, THEN THE function SHALL return HTTP 403 with `{ error: 'forbidden' }`.
4. WHEN the Dodo Payments Refunds API returns a successful response, THE `dodo-refund` Edge Function SHALL insert a `webhook_events` row with `event_type = 'refund.initiated'` and `payload` containing the refund response; IF this database insert fails, THE function SHALL return HTTP 500 with `{ error: 'refund_record_failed' }` and SHALL NOT modify `wallets.balance`.
5. IF the Dodo Payments Refunds API returns an error, THEN THE `dodo-refund` Edge Function SHALL return HTTP 502 with `{ error: 'refund_failed', detail: <dodo_error_message> }` and SHALL NOT modify `wallets.balance`.
6. THE `TransactionHistory` page SHALL display `credit_transactions` rows of `type = 'refund'` with a red badge labelled "Refund" and the amount formatted with a leading minus sign (e.g., `-10`).
7. WHEN a refund transaction is displayed, THE `TransactionHistory` page SHALL show the `description` field and the `created_at` timestamp formatted as `YYYY-MM-DD HH:MM:SS` in the user's local timezone.

---

### Requirement 7 — Sandbox and Test Mode Tooling

**User Story:** As a developer, I want clear sandbox tooling and documentation so that I can test the full payment lifecycle — checkout, webhook delivery, refunds, and credit top-ups — without processing real transactions.

#### Acceptance Criteria

1. WHEN `DODO_PAYMENTS_ENVIRONMENT = test_mode`, THE `create-checkout` Edge Function SHALL use `environment: 'test_mode'` and route all API calls to `https://test.dodopayments.com`.
2. WHEN `DODO_PAYMENTS_ENVIRONMENT = live_mode`, THE `create-checkout` Edge Function SHALL use `environment: 'live_mode'` and route all API calls to `https://live.dodopayments.com`.
3. IF `DODO_PAYMENTS_ENVIRONMENT` and `VITE_DODO_PAYMENTS_ENVIRONMENT` do not match at startup, THEN THE server-side Edge Functions SHALL log an error and reject all incoming requests with HTTP 500 until the mismatch is resolved.
4. THE `AddCredits` page SHALL display a yellow "Sandbox Mode" badge in the page header WHEN `VITE_DODO_PAYMENTS_ENVIRONMENT = test_mode`.
5. WHILE `DODO_PAYMENTS_ENVIRONMENT = test_mode`, THE `dodo-webhook` Edge Function SHALL accept and process payloads where the `webhook-signature` header is absent, treating them as valid.
6. WHILE `DODO_PAYMENTS_ENVIRONMENT = live_mode`, THE `dodo-webhook` Edge Function SHALL reject all payloads where the `webhook-signature` header is absent or signature validation fails, returning HTTP 401 with `{ error: 'invalid_signature' }`.
7. THE `.env.example` file SHALL document all required Dodo Payments environment variables: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT`, `VITE_DODO_PAYMENTS_ENABLED`, `VITE_DODO_PAYMENTS_ENVIRONMENT`, with example values and comments explaining test vs live mode.
8. THE `docs/ops/` directory SHALL contain a `dodo-payments-ops.md` file documenting: (a) how to add test credits manually using `manual_credit_topup`; (b) how to process a refund using the `dodo-refund` Edge Function; (c) how to use Dodo Payments test cards (`4242424242424242`, `5555555555554444`) and test UPI IDs (`success@upi`, `failure@upi`); (d) how to use the Dodo Payments CLI (`dodo wh listen`) to forward test webhooks to a local development server.

---

### Requirement 8 — Database Schema Updates

**User Story:** As a platform engineer, I want the database schema updated to support Dodo Payments payment tracking, so that all payment events are auditable and the existing RLS policies continue to protect user data.

#### Acceptance Criteria

1. THE Database SHALL add a nullable `dodo_payment_id text` column to `credit_transactions`; existing rows with no Dodo payment SHALL have this column set to NULL.
2. THE Database SHALL add a nullable `dodo_product_id text` column to `credit_transactions`; existing rows with no Dodo product SHALL have this column set to NULL.
3. THE `webhook_events` table SHALL accept INSERT of rows with `source = 'dodo_payments'` without error; a test INSERT with that value SHALL succeed and be retrievable by SELECT.
4. THE Database SHALL add a `reference_id text` column to `webhook_events` with a UNIQUE constraint; the column SHALL accept a maximum of 255 characters.
5. WHEN two rows are inserted into `webhook_events` with the same `reference_id`, THE Database SHALL raise a unique-constraint violation and reject the second insert.
6. THE Database SHALL create an index on `webhook_events(reference_id)` such that a lookup by `reference_id` completes in under 10 milliseconds on a table with up to 1,000,000 rows.
7. THE `dodo_products` table SHALL enforce RLS such that an authenticated user can SELECT rows where `is_active = true` and cannot INSERT, UPDATE, or DELETE any row.
8. WHEN `npx supabase db push` is executed against a clean database, THE Migration System SHALL exit with code 0 and produce no error output for all applied migrations.

---

### Requirement 9 — Frontend Integration

**User Story:** As a user, I want the Add Credits page to show real credit packs, my live wallet balance, and clear feedback during and after checkout, so that I always know my credit balance and purchase status.

#### Acceptance Criteria

1. WHILE `creditsService.getCreditPacks()` is in progress, THE `AddCredits` page SHALL display exactly 3 loading skeleton cards in place of the credit pack list.
2. WHEN `creditsService.getCreditPacks()` returns a non-empty array, THE `AddCredits` page SHALL replace the skeleton cards with the returned credit packs.
3. IF `creditsService.getCreditPacks()` returns an empty array, THE `AddCredits` page SHALL display the message: "No credit packs available. Please check back later."
4. THE `AddCredits` page SHALL display the user's current wallet balance from `creditsService.getWallet(userId)`; WHEN the URL contains the query parameter `checkout=success`, THE page SHALL re-fetch the wallet balance from the server and update the displayed value.
5. WHEN a purchase button is clicked, THE `AddCredits` page SHALL disable all purchase buttons and show a spinner on the clicked button WHILE the `create-checkout` invocation is in progress; WHEN the invocation succeeds, THE page SHALL redirect to the checkout URL; IF the invocation fails, THE page SHALL re-enable all buttons, remove the spinner, and display an inline error message.
6. THE `AddCredits` page SHALL NOT use `window.alert()` for any user-facing interaction.
7. THE `creditsService` SHALL export a `getCreditPacks()` function that returns `DodoProduct[]`; IF the query fails, THE function SHALL call `reportError` and return `[]`.
8. THE `DodoProduct` interface SHALL be exported from `src/types/index.ts` with fields: `id: string`, `product_id: string`, `label: string`, `credits: number`, `price_display: string`, `is_active: boolean`, `is_popular: boolean`.
9. ALL `catch` blocks in `creditsService` and the `AddCredits` page SHALL use `catch (error: unknown)` with `reportError` from `src/utils/errorReporter.ts`.
10. WHEN `npx tsc --noEmit` is executed from `frontend/`, THE TypeScript compiler SHALL exit with code 0 with no errors in `AddCredits.tsx`, `creditsService.ts`, or any new type definitions.

---

### Requirement 10 — Correctness Properties

**User Story:** As a quality engineer, I want property-based tests for the payment data flow, so that credit balance invariants and idempotency guarantees are verified across a wide range of inputs.

#### Acceptance Criteria

1. WHEN a valid `payment.succeeded` webhook payload (verified signature, non-empty `product_cart`, `credits_purchased > 0`) is processed for the first time, THE system SHALL insert exactly one `credit_transactions` row of type `purchase` and increment `wallets.balance` by exactly `credits_purchased`.
2. IF the same `webhook-id` is submitted a second time, THEN THE `dodo-webhook` Edge Function SHALL return HTTP 200 with `{ received: true, duplicate: true }` and SHALL NOT insert any additional rows into `credit_transactions` or modify `wallets.balance`.
3. WHEN a `payment.succeeded` event is followed by a `refund.succeeded` event for the same `payment_id`, THE net change to `wallets.balance` SHALL equal `credits_purchased - credits_refunded`.
4. IF `credits_refunded` exceeds the current `wallets.balance` at the time of refund processing, THEN `wallets.balance` SHALL be set to 0 and SHALL NOT go negative.
5. WHEN `manual_credit_topup` is called with `amount` between 1 and 1,000,000 inclusive, THE returned balance SHALL equal the previous balance plus `amount`.
6. WHEN `create-checkout` is invoked with a valid `product_id` (non-empty string matching an existing `dodo_products` row), THE returned `checkout_url` SHALL be a valid HTTPS URL beginning with `https://checkout.dodopayments.com` or `https://test.dodopayments.com`.
7. IF a webhook payload has an absent `webhook-signature` header, an unparseable signature value, or a signature that does not match the HMAC of the payload, THEN THE `dodo-webhook` Edge Function SHALL return HTTP 401 and the `webhook_events` table SHALL contain no new rows for that request.
8. WHEN `getCreditPacks()` receives a non-empty response from `dodo_products`, THE returned array SHALL contain only elements where `credits > 0` and `product_id` is a non-empty string.
9. IF `getCreditPacks()` receives an empty response from `dodo_products`, THE function SHALL return an empty array `[]` without throwing an exception.

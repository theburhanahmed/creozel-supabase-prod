# Requirements — mvp-credits-billing

## Introduction

The credits and billing pages (`AddCredits.tsx`, `TransactionHistory.tsx`, `UsageHistory.tsx`) are implemented. The remaining gaps are: wiring the Stripe Checkout flow via a Supabase Edge Function (currently shows an `alert()`), verifying all pages load real data from Supabase, and TypeScript strict mode compliance.

## Glossary

- **AddCredits**: Page at `frontend/src/pages/credits/AddCredits.tsx`
- **TransactionHistory**: Page at `frontend/src/pages/credits/TransactionHistory.tsx`
- **UsageHistory**: Page at `frontend/src/pages/credits/UsageHistory.tsx`
- **creditsService**: Service at `frontend/src/services/creditsService.ts`
- **create-checkout**: Supabase Edge Function that creates a Stripe Checkout session

## Requirements

### Requirement 1 — Stripe Checkout Integration

**User Story:** As a user, I want clicking "Purchase" to redirect me to a Stripe Checkout page, so that I can buy credits securely.

#### Acceptance Criteria

1. THE `create-checkout` Edge Function SHALL accept `{ credits: number, price: string }` in the request body and return a Stripe Checkout session URL.
2. WHEN the user clicks "Purchase" on a credit pack, THE `AddCredits` page SHALL invoke `supabase.functions.invoke('create-checkout', { body: { credits, price } })` and redirect to the returned Checkout URL.
3. IF `VITE_STRIPE_PUBLIC_KEY` is not set, THE `AddCredits` page SHALL display a configuration warning message instead of the purchase button.
4. WHEN Stripe redirects back after successful payment, THE `create-checkout` Edge Function's webhook handler SHALL update the `wallets` table and insert a `credit_transactions` row of type `purchase`.
5. THE `AddCredits` page SHALL NOT use `alert()` for any user-facing interaction.

### Requirement 2 — Transaction History

**User Story:** As a user, I want to see all my credit transactions with type, amount, description, and date.

#### Acceptance Criteria

1. THE `TransactionHistory` page SHALL load transactions from `credit_transactions` via `getTransactions` in `creditsService`.
2. WHEN the table is empty, THE page SHALL show an empty-state with a `ReceiptIcon`.
3. ALL `catch` blocks SHALL use `catch (error: unknown)` with `reportError`.

### Requirement 3 — Usage History

**User Story:** As a user, I want to see my AI generation usage history with content type, credits used, and date.

#### Acceptance Criteria

1. THE `UsageHistory` page SHALL load `content_jobs` rows filtered by `user_id` and ordered by `created_at DESC`.
2. EACH row SHALL display: content type icon, prompt (truncated), credits used, status badge, and date.
3. WHEN the table is empty, THE page SHALL show an empty-state message.

### Requirement 4 — TypeScript Strict Mode

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed, THE TypeScript compiler SHALL exit with code 0 with no errors in any credits page or `creditsService.ts`.

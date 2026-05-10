# Tasks — mvp-credits-billing

- [ ] 1. Create `create-checkout` Supabase Edge Function
  - Create `supabase/functions/create-checkout/index.ts`
  - Accept `{ credits, price }` in request body
  - Create Stripe Checkout session and return `{ url }`
  - Implement Stripe webhook handler to update `wallets` and insert `credit_transactions`
  - **Validates:** Requirements 1.1, 1.4

- [ ] 2. Update `AddCredits.tsx` to use Edge Function
  - Replace `alert()` with `supabase.functions.invoke('create-checkout', ...)`
  - Redirect to returned Checkout URL on success
  - Show `toast.error` on failure
  - Show configuration warning when `VITE_STRIPE_PUBLIC_KEY` is not set
  - **Validates:** Requirements 1.2, 1.3, 1.5

- [ ] 3. Verify `UsageHistory.tsx` loads real content_jobs data
  - Confirm `UsageHistory.tsx` queries `content_jobs` table via `creditsService`
  - If not implemented, create the page with content type icon, prompt, credits used, status, date
  - Add empty-state when no jobs exist
  - **Validates:** Requirements 3.1–3.3

- [ ] 4. TypeScript strict mode verification
  - Run `npx tsc --noEmit` from `frontend/`
  - Fix any errors in credits pages and `creditsService.ts`
  - **Validates:** Requirement 4.1

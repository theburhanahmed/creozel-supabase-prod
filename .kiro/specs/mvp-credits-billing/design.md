# Design — mvp-credits-billing

## Overview

Credits pages are largely implemented. The main gap is replacing the `alert()` in `AddCredits.tsx` with a real Stripe Checkout flow via a Supabase Edge Function.

## Architecture

```
AddCredits.tsx
  └── handlePurchase(credits, price)
        → supabase.functions.invoke('create-checkout', { body: { credits, price } })
        → redirect to Stripe Checkout URL
        → Stripe webhook → Edge Function → wallets.balance += credits
                                         → credit_transactions INSERT

TransactionHistory.tsx
  └── getTransactions(userId)  → supabase.from('credit_transactions')

UsageHistory.tsx
  └── getUsageHistory(userId)  → supabase.from('content_jobs')
```

## Components

### `create-checkout` Edge Function

```typescript
// supabase/functions/create-checkout/index.ts
// 1. Receive { credits, price } from request body
// 2. Create Stripe Checkout session with line_items
// 3. Return { url: session.url }
// Webhook handler: on checkout.session.completed
//   → update wallets.balance
//   → insert credit_transactions row
```

### `AddCredits.tsx` update

Replace the `alert()` call with:
```typescript
const { data, error } = await supabase.functions.invoke('create-checkout', {
  body: { credits: plan.credits, price: plan.price }
})
if (error || !data?.url) {
  toast.error('Failed to start checkout. Please try again.')
  return
}
window.location.href = data.url as string
```

## Correctness Properties

- **Purchase creates transaction**: After a successful Stripe payment, a `credit_transactions` row of type `purchase` must exist and `wallets.balance` must increase by the purchased credit amount.
- **No alert() in production**: The `AddCredits` page must never call `window.alert()`.

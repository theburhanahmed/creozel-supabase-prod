# Design — mvp-affiliate

## Overview

The Affiliate page is implemented but uses direct `supabase` calls in the component. The design extracts these into a service layer and adds referral code generation.

## Architecture

```
AffiliatePage.tsx
  └── getAffiliateData(userId)  → affiliateService
        ├── supabase.from('profiles').select('referral_code').eq('id', userId)
        │     → if null: generate code + update profiles
        ├── supabase.from('affiliate_earnings').select('*').eq('user_id', userId)
        └── supabase.from('referral_events').select('*').eq('referrer_id', userId)
```

## Referral Code Generation

```typescript
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
```

## Correctness Properties

- **Referral code is unique**: The generated code must not conflict with existing codes (use `ON CONFLICT DO NOTHING` and retry if needed).
- **Service layer isolation**: `AffiliatePage.tsx` must not import `supabase` directly.

# Tasks — mvp-affiliate

- [ ] 1. Verify `AffiliatePage.tsx` uses service layer (not direct supabase calls)
  - Extract the three Supabase queries in `AffiliatePage.tsx` into an `affiliateService.ts`
  - Implement `getAffiliateData(userId)` that fetches `profiles.referral_code`, `affiliate_earnings`, and `referral_events` in parallel
  - Use `catch (error: unknown)` with `reportError` in all catch blocks
  - **Validates:** Requirements 1.1–1.3

- [ ] 2. Generate referral code if missing
  - If `profiles.referral_code` is null for the user, generate a unique code and update the profile
  - Use a short alphanumeric code (e.g., 8 characters)
  - **Validates:** Requirement 2.1

- [ ] 3. Verify `referral_events` column name matches schema
  - The `AffiliatePage.tsx` queries `referrer_user_id` but the PRD schema uses `referrer_id`
  - Verify the actual column name in the migration and update the query if needed
  - **Validates:** Requirement 1.2

- [ ] 4. TypeScript strict mode verification
  - Run `npx tsc --noEmit` from `frontend/`
  - Fix any errors in `AffiliatePage.tsx`
  - Remove direct `supabase` import from the page component (use service layer)
  - **Validates:** Requirement 3.1

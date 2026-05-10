# Requirements — mvp-affiliate

## Introduction

The Affiliate page (`AffiliatePage.tsx`) is implemented with referral link display, earnings history, and stats. The remaining gaps are: extracting Supabase queries into a service layer, generating referral codes for users who don't have one, and TypeScript strict mode compliance.

## Glossary

- **AffiliatePage**: Page at `frontend/src/pages/affiliate/AffiliatePage.tsx`
- **affiliateService**: Service module to be created at `frontend/src/services/affiliateService.ts`
- **referral_code**: A unique code stored in `profiles.referral_code` used to track referrals

## Requirements

### Requirement 1 — Service Layer

**User Story:** As a developer, I want affiliate data fetching in a service layer, not directly in the page component.

#### Acceptance Criteria

1. THE `AffiliatePage` SHALL NOT import `supabase` directly — all data access SHALL go through `affiliateService`.
2. THE `affiliateService` SHALL export `getAffiliateData(userId)` that fetches `referral_code`, `affiliate_earnings`, and `referral_events` in parallel.
3. ALL catch blocks in `affiliateService` SHALL use `catch (error: unknown)` with `reportError`.

### Requirement 2 — Referral Code Generation

**User Story:** As a new user, I want a referral code automatically generated for me.

#### Acceptance Criteria

1. WHEN `profiles.referral_code` is null for the authenticated user, THE `affiliateService` SHALL generate a unique 8-character alphanumeric code and update the `profiles` row.

### Requirement 3 — TypeScript Strict Mode

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed, THE TypeScript compiler SHALL exit with code 0 with no errors in `AffiliatePage.tsx` or `affiliateService.ts`.

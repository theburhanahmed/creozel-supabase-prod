# Implementation Plan: mvp-auth-flow

## Overview

Harden the MVP authentication flow across six areas: fix the `debounce` generic constraint, remove the race-condition `setUser` call in `LoginForm`, enrich `mapSupabaseUser` with a real `profiles` table query, add `ForgotPasswordPage` and `ResetPasswordPage`, add a minimal `OnboardingPage`, and update `AuthGuard` to redirect incomplete-onboarding users. All auth state flows exclusively through `supabase.auth.onAuthStateChange`.

---

## Tasks

- [ ] 1. Fix `debounce` generic constraint in `lib/utils.ts`
  - Change the generic constraint from `(...args: string[]) => unknown` to `(...args: unknown[]) => unknown`
  - Preserve `Parameters<T>` inference so callers retain full type safety
  - **Validates:** Requirements 1.1, 1.3

- [ ] 2. Enrich `mapSupabaseUser` with `profiles` table query
  - Convert `mapSupabaseUser` to `async function mapSupabaseUser(...): Promise<User>`
  - Add `supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single()` query
  - Default `onboarding_completed` to `false` on error or null row
  - Use `catch (error: unknown)` with `error instanceof Error` guard
  - Update all callers (`login`, `register`, `getCurrentUser`, `onAuthStateChange`) to `await mapSupabaseUser(...)`
  - **Validates:** Requirements 3.1–3.4, 9.4

- [ ] 3. Remove race-condition `setUser` call from `LoginForm.tsx`
  - Remove `const { setUser } = useAppContext()` destructuring
  - Remove `setUser(u)` from the `.then()` callback; keep `toast.success(...)` and `navigate('/', { replace: true })`
  - **Validates:** Requirements 2.1, 2.2, 9.1, 9.2

- [ ] 4. Create `ForgotPasswordPage` at `/auth/forgot-password`
  - Create `frontend/src/pages/auth/ForgotPasswordPage.tsx`
  - Controlled `email`, `loading`, `submitted`, `error` state
  - On submit: call `authService.resetPassword(email)`; on success set `submitted = true`; on error display message
  - Match existing auth page visual style; include "Back to login" link
  - Use `catch (error: unknown)` with `error instanceof Error` guard
  - **Validates:** Requirements 4.1–4.7, 10.3

- [ ] 5. Create `ResetPasswordPage` at `/auth/reset-password`
  - Create `frontend/src/pages/auth/ResetPasswordPage.tsx`
  - Rely on `detectSessionInUrl: true` (already set) to exchange GoTrue recovery token
  - Client-side validation: passwords must match and be ≥ 8 characters
  - On valid submit: call `authService.updatePassword(newPassword)`; on success navigate to `/auth/login`
  - Use `catch (error: unknown)` with `error instanceof Error` guard
  - **Validates:** Requirements 5.1–5.10, 10.4

- [ ] 6. Create `OnboardingPage` at `/onboarding`
  - Create `frontend/src/pages/onboarding/OnboardingPage.tsx`
  - Render minimal placeholder UI with "Get started" CTA button
  - On click: `supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)`
  - On success: call `authService.getCurrentUser()` → `setUser(updatedUser)` → `navigate('/', { replace: true })`
  - Use `catch (error: unknown)` with `error instanceof Error` guard
  - **Validates:** Requirements 6.1–6.7, 10.5

- [ ] 7. Update `AuthGuard.tsx` with onboarding redirect
  - Import `useLocation` from `react-router-dom`
  - Add redirect: if `!user.onboarding_completed && location.pathname !== '/onboarding'` → `<Navigate to="/onboarding" replace />`
  - Insert after the `!user` null check and before rendering children
  - **Validates:** Requirements 7.1–7.4

- [ ] 8. Update `AppContext.tsx` for async `mapSupabaseUser`
  - Verify `onAuthStateChange` callback correctly awaits the resolved `User | null` from `authService`
  - Ensure `setUser` is only called inside `onAuthStateChange` and the initial `getCurrentUser` call
  - **Validates:** Requirements 9.1, 9.3, 9.4

- [ ] 9. Register new routes in `App.tsx`
  - Add lazy imports for `ForgotPasswordPage`, `ResetPasswordPage`, `OnboardingPage`
  - Register `/auth/forgot-password` and `/auth/reset-password` as public routes
  - Register `/onboarding` as a protected route inside `AuthGuard`
  - **Validates:** Requirements 8.1–8.4

- [ ] 10. Final TypeScript verification
  - Run `npx tsc --noEmit` in `frontend/` and confirm exit code 0
  - Verify all `catch` blocks use `catch (error: unknown)` with `error instanceof Error` guards
  - **Validates:** Requirements 1.2, 10.1–10.6

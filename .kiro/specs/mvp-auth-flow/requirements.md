# Requirements Document

## Introduction

This feature completes and hardens the MVP authentication flow for the Creozel frontend. It covers six areas:

1. **Bug fixes** — correct the `debounce` generic constraint in `lib/utils.ts` and remove the race-condition `setUser` call in `LoginForm`.
2. **Profile enrichment** — make `mapSupabaseUser` in `authService.ts` fetch `onboarding_completed` from the `profiles` table so the field reflects real database state.
3. **Forgot-password page** — a new `/auth/forgot-password` route with an email-entry form that triggers GoTrue's recovery email.
4. **Reset-password page** — a new `/auth/reset-password` route that handles the GoTrue recovery token and lets the user set a new password.
5. **Onboarding page** — a minimal `/onboarding` placeholder that marks `profiles.onboarding_completed = true` and redirects to the dashboard.
6. **Onboarding redirect** — `AuthGuard` / `AppContext` redirects authenticated users whose `onboarding_completed` is `false` to `/onboarding` before they can access protected routes.

All auth state flows exclusively through `supabase.auth.onAuthStateChange`. No direct `setUser` calls are made after login. All `catch` blocks use `catch (error: unknown)` with type guards.

---

## Glossary

- **AuthGuard**: The `AuthGuard` React component in `src/components/auth/AuthGuard.tsx` that protects all routes under `/*`.
- **AppContext**: The React context provider in `src/context/AppContext.tsx` that holds the canonical `user` state and `isAuthLoading` flag.
- **AuthService**: The `authService` object in `src/services/authService.ts` that wraps all Supabase GoTrue calls.
- **LoginForm**: The `LoginForm` React component in `src/components/auth/LoginForm.tsx`.
- **ForgotPasswordPage**: The new React page component rendered at `/auth/forgot-password`.
- **ResetPasswordPage**: The new React page component rendered at `/auth/reset-password`.
- **OnboardingPage**: The new React page component rendered at `/onboarding`.
- **DebounceUtil**: The `debounce` function exported from `src/lib/utils.ts`.
- **GoTrue**: The Supabase authentication server that manages JWT sessions and password-reset recovery tokens.
- **profiles table**: The PostgreSQL `profiles` table linked to `auth.users`, containing the `onboarding_completed` boolean column.
- **recovery token**: The one-time JWT embedded in the GoTrue password-reset email link, consumed by the Supabase client on the reset-password page.
- **onAuthStateChange**: The `supabase.auth.onAuthStateChange` subscription that is the single source of truth for auth state in `AppContext`.

---

## Requirements

### Requirement 1 — Fix `debounce` Generic Type Constraint

**User Story:** As a developer, I want the `debounce` utility to accept functions with any argument types, so that I can debounce handlers that receive non-string parameters without TypeScript errors.

#### Acceptance Criteria

1. THE `DebounceUtil` SHALL accept a generic type parameter `T` constrained to `(...args: unknown[]) => unknown` so that functions with any argument types can be passed without a TypeScript compile error.
2. WHEN `npx tsc --noEmit` is executed against the frontend, THE TypeScript compiler SHALL exit with code 0 with the updated `debounce` signature in place.
3. THE `DebounceUtil` SHALL preserve the `Parameters<T>` inference so that callers retain full type safety on the debounced function's arguments.

---

### Requirement 2 — Remove Race-Condition `setUser` Call in `LoginForm`

**User Story:** As a user, I want my session to be set exactly once after login, so that I never experience a stale or duplicate state update caused by a direct `setUser` call racing with `onAuthStateChange`.

#### Acceptance Criteria

1. WHEN a successful login response is received by `LoginForm`, THE `LoginForm` SHALL NOT call `setUser` directly; auth state SHALL be updated exclusively via the `onAuthStateChange` subscription in `AppContext`.
2. WHEN a successful login response is received by `LoginForm`, THE `LoginForm` SHALL display a success toast and navigate to `/` without calling `setUser`.
3. WHILE a login request is in-flight, THE `LoginForm` SHALL keep the submit button disabled and display a loading indicator.
4. IF the login request fails, THEN THE `LoginForm` SHALL display the error message returned by `AuthService` and re-enable the submit button.

---

### Requirement 3 — Fetch `onboarding_completed` from `profiles` Table

**User Story:** As a developer, I want `mapSupabaseUser` to read `onboarding_completed` from the `profiles` table, so that the value reflects the actual database state rather than always defaulting to `false`.

#### Acceptance Criteria

1. WHEN `mapSupabaseUser` is called with a Supabase auth user, THE `AuthService` SHALL query `supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single()` and use the returned value to populate `User.onboarding_completed`.
2. IF the `profiles` query returns an error or a null row, THEN THE `AuthService` SHALL default `User.onboarding_completed` to `false` and SHALL NOT throw an unhandled exception.
3. THE `AuthService` SHALL use `catch (error: unknown)` with a type guard when handling errors from the `profiles` query.
4. WHEN `onAuthStateChange` fires after login, THE `AppContext` SHALL receive a `User` object whose `onboarding_completed` field reflects the value stored in the `profiles` table.

---

### Requirement 4 — `ForgotPassword` Page at `/auth/forgot-password`

**User Story:** As a user who has forgotten my password, I want to enter my email address and receive a password-reset link, so that I can regain access to my account.

#### Acceptance Criteria

1. THE `App` SHALL register a public route at `/auth/forgot-password` that renders `ForgotPasswordPage` without requiring authentication.
2. THE `ForgotPasswordPage` SHALL render an email input field and a submit button.
3. WHEN the user submits a valid email address, THE `ForgotPasswordPage` SHALL call `authService.resetPassword(email)`, which invokes `supabase.auth.resetPasswordForEmail` with `redirectTo` set to `${window.location.origin}/auth/reset-password`.
4. WHEN `authService.resetPassword` resolves successfully, THE `ForgotPasswordPage` SHALL display a confirmation message instructing the user to check their email, and SHALL disable the submit button to prevent duplicate submissions.
5. IF `authService.resetPassword` throws an error, THEN THE `ForgotPasswordPage` SHALL display the error message and re-enable the submit button.
6. THE `ForgotPasswordPage` SHALL use `catch (error: unknown)` with a type guard when handling errors from `authService.resetPassword`.
7. WHILE a reset request is in-flight, THE `ForgotPasswordPage` SHALL disable the submit button and display a loading indicator.

---

### Requirement 5 — `ResetPassword` Page at `/auth/reset-password`

**User Story:** As a user who clicked a password-reset link in my email, I want to enter and confirm a new password, so that I can update my credentials and log in.

#### Acceptance Criteria

1. THE `App` SHALL register a public route at `/auth/reset-password` that renders `ResetPasswordPage` without requiring authentication.
2. WHEN `ResetPasswordPage` mounts, THE `ResetPasswordPage` SHALL rely on the Supabase client's `detectSessionInUrl: true` configuration to automatically exchange the GoTrue recovery token present in the URL hash for a valid session.
3. WHEN the Supabase client fires an `onAuthStateChange` event with event type `PASSWORD_RECOVERY`, THE `AppContext` SHALL set `isAuthLoading` to `false` and allow `ResetPasswordPage` to render the new-password form.
4. THE `ResetPasswordPage` SHALL render a new-password input field, a confirm-password input field, and a submit button.
5. WHEN the user submits matching passwords of at least 8 characters, THE `ResetPasswordPage` SHALL call `authService.updatePassword(newPassword)`.
6. IF the two password fields do not match, THEN THE `ResetPasswordPage` SHALL display a validation error and SHALL NOT call `authService.updatePassword`.
7. WHEN `authService.updatePassword` resolves successfully, THE `ResetPasswordPage` SHALL display a success toast and navigate to `/auth/login`.
8. IF `authService.updatePassword` throws an error, THEN THE `ResetPasswordPage` SHALL display the error message and re-enable the submit button.
9. THE `ResetPasswordPage` SHALL use `catch (error: unknown)` with a type guard when handling errors from `authService.updatePassword`.
10. WHILE a password-update request is in-flight, THE `ResetPasswordPage` SHALL disable the submit button and display a loading indicator.

---

### Requirement 6 — `Onboarding` Page at `/onboarding`

**User Story:** As a newly registered user, I want to complete a brief onboarding step, so that the platform knows I have finished setup and stops redirecting me to onboarding on subsequent visits.

#### Acceptance Criteria

1. THE `App` SHALL register a protected route at `/onboarding` that renders `OnboardingPage` inside `AuthGuard`.
2. THE `OnboardingPage` SHALL render a minimal placeholder UI with a "Get started" or equivalent call-to-action button.
3. WHEN the user clicks the call-to-action button, THE `OnboardingPage` SHALL call `supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)`.
4. WHEN the `profiles` update resolves successfully, THE `OnboardingPage` SHALL navigate to `/` (the dashboard).
5. IF the `profiles` update returns an error, THEN THE `OnboardingPage` SHALL display the error message and re-enable the call-to-action button.
6. THE `OnboardingPage` SHALL use `catch (error: unknown)` with a type guard when handling errors from the `profiles` update.
7. WHILE the `profiles` update is in-flight, THE `OnboardingPage` SHALL disable the call-to-action button and display a loading indicator.

---

### Requirement 7 — Onboarding Redirect in `AuthGuard`

**User Story:** As a newly registered user whose `onboarding_completed` is `false`, I want to be automatically redirected to `/onboarding` when I try to access any protected page, so that I complete setup before using the application.

#### Acceptance Criteria

1. WHILE `isAuthLoading` is `true`, THE `AuthGuard` SHALL render the existing loading spinner and SHALL NOT redirect.
2. WHEN `isAuthLoading` is `false` and `user` is `null`, THE `AuthGuard` SHALL redirect to `/auth/login`.
3. WHEN `isAuthLoading` is `false`, `user` is not `null`, and `user.onboarding_completed` is `false`, THE `AuthGuard` SHALL redirect to `/onboarding`, unless the current route is already `/onboarding`.
4. WHEN `isAuthLoading` is `false`, `user` is not `null`, and `user.onboarding_completed` is `true`, THE `AuthGuard` SHALL render the protected child components without redirecting.
5. WHEN `OnboardingPage` successfully marks `onboarding_completed = true` and navigates to `/`, THE `AppContext` SHALL reflect the updated `onboarding_completed` value so that `AuthGuard` no longer redirects to `/onboarding`.

---

### Requirement 8 — Route Registration in `App.tsx`

**User Story:** As a developer, I want all new auth and onboarding routes registered in `App.tsx`, so that the application can navigate to them correctly.

#### Acceptance Criteria

1. THE `App` SHALL register `/auth/forgot-password` as a public route rendering `ForgotPasswordPage`.
2. THE `App` SHALL register `/auth/reset-password` as a public route rendering `ResetPasswordPage`.
3. THE `App` SHALL register `/onboarding` as a protected route inside `AuthGuard` rendering `OnboardingPage`.
4. THE `ForgotPasswordPage`, `ResetPasswordPage`, and `OnboardingPage` components SHALL be imported using React lazy loading consistent with the existing pattern in `App.tsx`.

---

### Requirement 9 — Exclusive `onAuthStateChange` Auth State Management

**User Story:** As a developer, I want all auth state updates to flow exclusively through `onAuthStateChange`, so that there is a single source of truth and no risk of stale state from direct `setUser` calls.

#### Acceptance Criteria

1. THE `AppContext` SHALL update `user` state only inside the `onAuthStateChange` callback and the initial `getCurrentUser` call on mount.
2. THE `LoginForm`, `ForgotPasswordPage`, `ResetPasswordPage`, and `OnboardingPage` SHALL NOT call `setUser` directly.
3. WHEN `supabase.auth.onAuthStateChange` fires with a `null` session, THE `AppContext` SHALL set `user` to `null`.
4. WHEN `supabase.auth.onAuthStateChange` fires with a valid session, THE `AppContext` SHALL call `mapSupabaseUser` (which fetches `onboarding_completed` from the `profiles` table) and set the result as `user`.

---

### Requirement 10 — Consistent Error Handling with Type Guards

**User Story:** As a developer, I want all `catch` blocks in auth-related code to use `catch (error: unknown)` with type guards, so that the codebase complies with TypeScript strict mode and the project's coding standards.

#### Acceptance Criteria

1. THE `AuthService` SHALL use `catch (error: unknown)` in every `try/catch` block, and SHALL check `error instanceof Error` before accessing `error.message`.
2. THE `LoginForm` SHALL use `catch (error: unknown)` and SHALL check `error instanceof Error` before accessing `error.message`.
3. THE `ForgotPasswordPage` SHALL use `catch (error: unknown)` and SHALL check `error instanceof Error` before accessing `error.message`.
4. THE `ResetPasswordPage` SHALL use `catch (error: unknown)` and SHALL check `error instanceof Error` before accessing `error.message`.
5. THE `OnboardingPage` SHALL use `catch (error: unknown)` and SHALL check `error instanceof Error` before accessing `error.message`.
6. WHEN `npx tsc --noEmit` is executed against the frontend after all changes, THE TypeScript compiler SHALL exit with code 0.

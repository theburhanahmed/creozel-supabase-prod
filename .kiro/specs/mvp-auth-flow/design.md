# Design Document — `mvp-auth-flow`

## Overview

This document describes the architecture and implementation plan for hardening the MVP authentication flow in the Creozel frontend. The work touches six areas: fixing the `debounce` generic constraint, removing a race-condition `setUser` call in `LoginForm`, enriching `mapSupabaseUser` with a real `profiles` table query, adding `ForgotPasswordPage` and `ResetPasswordPage`, adding a minimal `OnboardingPage`, and updating `AuthGuard` to redirect incomplete-onboarding users.

All auth state flows exclusively through `supabase.auth.onAuthStateChange`. No component calls `setUser` directly after a login or registration action.

---

## Architecture

### Auth State Flow

```
Supabase GoTrue
      │
      │  onAuthStateChange(event, session)
      ▼
AppContext (AppProvider)
  ├── getCurrentUser() on mount  ──► mapSupabaseUser()  ──► profiles table query
  └── onAuthStateChange callback ──► mapSupabaseUser()  ──► profiles table query
      │
      ▼
  user: User | null
  isAuthLoading: boolean
      │
      ▼
AuthGuard
  ├── isAuthLoading=true  → spinner
  ├── user=null           → Navigate /auth/login
  ├── !onboarding_completed && path≠/onboarding → Navigate /onboarding
  └── onboarding_completed → render children
```

### Component Responsibility Map

| Component / Module | Responsibility |
|---|---|
| `supabase.ts` | Single Supabase client; `detectSessionInUrl: true` already set |
| `authService.ts` | All GoTrue calls; `mapSupabaseUser` fetches `profiles` row |
| `AppContext.tsx` | Single source of truth for `user` and `isAuthLoading`; subscribes to `onAuthStateChange` |
| `AuthGuard.tsx` | Route protection + onboarding redirect |
| `LoginForm.tsx` | Login form; no `setUser` call; navigates on success |
| `ForgotPasswordPage.tsx` | Email entry; calls `authService.resetPassword` |
| `ResetPasswordPage.tsx` | New-password form; calls `authService.updatePassword`; handles `PASSWORD_RECOVERY` event |
| `OnboardingPage.tsx` | Marks `profiles.onboarding_completed = true`; navigates to `/` |
| `App.tsx` | Route registration; lazy imports |
| `lib/utils.ts` | `debounce` generic constraint fix |

---

## Components and Interfaces

### 1. `debounce` in `lib/utils.ts`

**Current problem:** The generic is constrained to `(...args: string[]) => unknown`, which rejects functions with non-string parameters (e.g., the login handler that receives typed form values).

**Fix:**

```typescript
// ✅ Fixed signature
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
```

`Parameters<T>` inference is preserved, so callers retain full type safety.

---

### 2. `authService.ts` — `mapSupabaseUser` enrichment

`mapSupabaseUser` becomes `async` and queries the `profiles` table before returning.

```typescript
async function mapSupabaseUser(supabaseUser: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): Promise<User> {
  const meta = supabaseUser.user_metadata ?? {}

  let onboarding_completed = false
  try {
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', supabaseUser.id)
      .single()
    if (data) {
      onboarding_completed = data.onboarding_completed ?? false
    }
  } catch (error: unknown) {
    // Default to false — non-fatal; user will be redirected to onboarding
    if (error instanceof Error) {
      console.warn('profiles fetch failed:', error.message)
    }
  }

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    display_name:
      (meta['name'] as string) ??
      (meta['full_name'] as string) ??
      supabaseUser.email?.split('@')[0] ??
      'User',
    avatar_url: (meta['avatar_url'] as string) ?? '',
    timezone: 'UTC',
    notification_preferences: {},
    onboarding_completed,
    credits: 0,
    isAuthenticated: true,
  }
}
```

All callers of `mapSupabaseUser` (`login`, `register`, `getCurrentUser`, `onAuthStateChange`) must `await` it.

**`resetPassword` and `updatePassword`** already exist in `authService`; no changes needed there.

---

### 3. `AppContext.tsx` — async `mapSupabaseUser` + no direct `setUser` from components

The `onAuthStateChange` callback must `await` the now-async `mapSupabaseUser`. The `setUser` setter remains in context (used internally by `AppContext` and by `OnboardingPage` to refresh the user after marking onboarding complete), but no auth form component calls it.

```typescript
// Inside AppProvider useEffect
const { unsubscribe } = authService.onAuthStateChange(async (u) => {
  setUser(u)          // u is already resolved by authService
  setIsAuthLoading(false)
})
```

Since `authService.onAuthStateChange` wraps the async `mapSupabaseUser` internally, the callback receives a fully resolved `User | null`.

**`OnboardingPage` refresh pattern:** After a successful `profiles.update`, `OnboardingPage` calls `authService.getCurrentUser()` and then `setUser(updatedUser)` — this is the one permitted direct `setUser` call outside `AppContext`, because it is a deliberate profile refresh, not a login side-effect.

---

### 4. `LoginForm.tsx` — remove `setUser` call

**Current problem:** After a successful login, `LoginForm` calls `setUser(u)` directly, which races with the `onAuthStateChange` event that `AppContext` is already listening to.

**Fix:** Remove the `setUser` import and call. The `onAuthStateChange` subscription in `AppContext` will update `user` automatically.

```typescript
// ❌ Remove
import { useAppContext } from '../../context/AppContext'
const { setUser } = useAppContext()
// ...
.then((u) => {
  setUser(u)   // ← remove this line
  toast.success(...)
  navigate('/', { replace: true })
})

// ✅ After fix
.then(() => {
  toast.success('Welcome back!')
  navigate('/', { replace: true })
})
```

The debounced handler's type signature also updates to accept `(emailVal: string, passwordVal: string)` — this already works once the `debounce` generic is fixed.

---

### 5. `ForgotPasswordPage.tsx` — new page at `/auth/forgot-password`

**File:** `frontend/src/pages/auth/ForgotPasswordPage.tsx`

**State:**

| State variable | Type | Purpose |
|---|---|---|
| `email` | `string` | Controlled input value |
| `loading` | `boolean` | In-flight request guard |
| `submitted` | `boolean` | Show confirmation message after success |
| `error` | `string` | Error message to display |

**Behaviour:**
- On submit: calls `authService.resetPassword(email)`.
- On success: sets `submitted = true`, disables submit button permanently (prevents duplicate sends).
- On error: displays error message, re-enables submit.
- While in-flight: submit button disabled, spinner shown.
- Uses `catch (error: unknown)` with `error instanceof Error` guard.

**UI structure** (matches existing auth page style):
```
<AuthPageWrapper>
  <Logo />
  <h1>Reset your password</h1>
  {submitted ? <ConfirmationMessage /> : (
    <form>
      <EmailInput />
      <SubmitButton loading={loading} disabled={loading || submitted} />
    </form>
  )}
  <BackToLoginLink />
</AuthPageWrapper>
```

---

### 6. `ResetPasswordPage.tsx` — new page at `/auth/reset-password`

**File:** `frontend/src/pages/auth/ResetPasswordPage.tsx`

**Recovery token exchange:** The Supabase client is already configured with `detectSessionInUrl: true` in `supabase.ts`. When the user lands on `/auth/reset-password` with the GoTrue recovery hash in the URL, the client automatically exchanges the token and fires `onAuthStateChange` with event `PASSWORD_RECOVERY`. `AppContext` handles this event and sets `isAuthLoading = false`, allowing the page to render.

**State:**

| State variable | Type | Purpose |
|---|---|---|
| `newPassword` | `string` | New password input |
| `confirmPassword` | `string` | Confirm password input |
| `showPassword` | `boolean` | Toggle password visibility |
| `loading` | `boolean` | In-flight request guard |
| `error` | `string` | Validation or API error |

**Validation (client-side, before API call):**
- Passwords must match → error: "Passwords do not match"
- Password must be ≥ 8 characters → error: "Password must be at least 8 characters"

**Behaviour:**
- On valid submit: calls `authService.updatePassword(newPassword)`.
- On success: `toast.success(...)`, `navigate('/auth/login', { replace: true })`.
- On error: displays error, re-enables submit.
- Uses `catch (error: unknown)` with `error instanceof Error` guard.

---

### 7. `OnboardingPage.tsx` — new page at `/onboarding`

**File:** `frontend/src/pages/onboarding/OnboardingPage.tsx`

**State:**

| State variable | Type | Purpose |
|---|---|---|
| `loading` | `boolean` | In-flight update guard |
| `error` | `string` | Error message |

**Behaviour:**
1. User clicks "Get started".
2. Calls `supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)`.
3. On success: calls `authService.getCurrentUser()` → `setUser(updatedUser)` to refresh `AppContext`, then `navigate('/', { replace: true })`.
4. On error: displays error, re-enables button.
5. Uses `catch (error: unknown)` with `error instanceof Error` guard.

**Why `setUser` is called here:** `OnboardingPage` needs to update the in-memory `User` object so `AuthGuard` sees `onboarding_completed = true` immediately, without waiting for a new `onAuthStateChange` event (which would only fire on a session change, not a profile update).

---

### 8. `AuthGuard.tsx` — onboarding redirect

**Updated decision tree:**

```typescript
if (isAuthLoading) return <Spinner />
if (!user) return <Navigate to="/auth/login" replace />
if (!user.onboarding_completed && location.pathname !== '/onboarding') {
  return <Navigate to="/onboarding" replace />
}
return <>{children}</>
```

Requires `useLocation` from `react-router-dom` to read `location.pathname`.

---

### 9. `App.tsx` — route registration

Three new routes added:

```typescript
// Public routes (outside AuthGuard)
const ForgotPasswordPage = lazy(() =>
  import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
)
const ResetPasswordPage = lazy(() =>
  import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
)

// Protected route (inside AuthGuard)
const OnboardingPage = lazy(() =>
  import('./pages/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage }))
)

// In <Routes>:
<Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/auth/reset-password"  element={<ResetPasswordPage />} />

// Inside the AuthGuard protected block:
<Route path="/onboarding" element={<OnboardingPage />} />
```

---

## Data Models

No new tables or columns are introduced. The feature reads from and writes to the existing `profiles` table.

### `profiles` table (relevant columns)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | FK → `auth.users.id` |
| `onboarding_completed` | `boolean` | Defaults to `false`; set to `true` by `OnboardingPage` |

### `User` type (no changes needed)

The `User` interface in `src/types/index.ts` already has `onboarding_completed: boolean`. No type changes required.

---

## Error Handling

All `catch` blocks across the affected files follow this pattern:

```typescript
try {
  // ...
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  setError(message)
} finally {
  setLoading(false)
}
```

This satisfies TypeScript strict mode and the project's coding standards (Requirement 10).

### Error scenarios

| Scenario | Handling |
|---|---|
| `profiles` query fails in `mapSupabaseUser` | Default `onboarding_completed = false`; log warning; do not throw |
| Login fails | Display error in `LoginForm`; re-enable submit |
| `resetPassword` fails | Display error in `ForgotPasswordPage`; re-enable submit |
| `updatePassword` fails | Display error in `ResetPasswordPage`; re-enable submit |
| `profiles.update` fails in `OnboardingPage` | Display error; re-enable CTA button |
| Recovery token missing/expired | Supabase client handles; `onAuthStateChange` will not fire `PASSWORD_RECOVERY`; `ResetPasswordPage` shows a "link expired" message |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: `mapSupabaseUser` preserves `onboarding_completed` from the database

For any Supabase auth user whose `profiles` row has `onboarding_completed` set to either `true` or `false`, calling `mapSupabaseUser` (and therefore the `onAuthStateChange` callback in `AppContext`) SHALL produce a `User` object whose `onboarding_completed` field exactly matches the value stored in the `profiles` table.

**Validates: Requirements 3.1, 3.4, 9.4**

---

### Property 2: `AuthGuard` redirects any non-onboarded authenticated user to `/onboarding`

For any authenticated `User` with `onboarding_completed = false`, and for any protected route path other than `/onboarding`, `AuthGuard` SHALL redirect to `/onboarding` rather than rendering the protected children.

**Validates: Requirements 7.3**

---

### Property 3: Onboarding completion round-trip updates `AppContext`

For any authenticated user who completes the onboarding flow (clicks "Get started" and the `profiles.update` succeeds), the `user` object in `AppContext` SHALL subsequently have `onboarding_completed = true`, and `AuthGuard` SHALL no longer redirect that user to `/onboarding`.

**Validates: Requirements 7.5, 6.3, 6.4**

---

## Testing Strategy

### Unit / Example-based tests

These cover specific behaviors and error paths:

- `debounce` accepts functions with non-string argument types (Req 1.1, 1.3)
- `LoginForm` does not call `setUser` after successful login (Req 2.1)
- `LoginForm` shows success toast and navigates on login success (Req 2.2)
- `LoginForm` disables submit while loading (Req 2.3)
- `LoginForm` shows error and re-enables submit on failure (Req 2.4)
- `mapSupabaseUser` queries `profiles` table with correct user ID (Req 3.1)
- `mapSupabaseUser` defaults `onboarding_completed` to `false` on query error (Req 3.2)
- `ForgotPasswordPage` renders email input and submit button (Req 4.2)
- `ForgotPasswordPage` calls `authService.resetPassword` with submitted email (Req 4.3)
- `ForgotPasswordPage` shows confirmation and disables submit on success (Req 4.4)
- `ForgotPasswordPage` shows error and re-enables submit on failure (Req 4.5)
- `ResetPasswordPage` renders both password inputs and submit button (Req 5.4)
- `ResetPasswordPage` calls `authService.updatePassword` on valid matching passwords (Req 5.5)
- `ResetPasswordPage` shows validation error when passwords do not match (Req 5.6)
- `ResetPasswordPage` navigates to `/auth/login` on success (Req 5.7)
- `OnboardingPage` renders CTA button (Req 6.2)
- `OnboardingPage` calls `profiles.update` with `onboarding_completed: true` on click (Req 6.3)
- `OnboardingPage` navigates to `/` on success (Req 6.4)
- `AuthGuard` renders spinner while `isAuthLoading = true` (Req 7.1)
- `AuthGuard` redirects to `/auth/login` when `user = null` (Req 7.2)
- `AuthGuard` renders children when user is authenticated and onboarded (Req 7.4)
- `AppContext` sets `user = null` when `onAuthStateChange` fires with null session (Req 9.3)

### Property-based tests

Minimum 100 iterations each. Use `fast-check` (already a common choice in TypeScript projects).

**Property 1 test:** Generate random boolean values for `onboarding_completed` in a mocked `profiles` response. For each, call `mapSupabaseUser` and assert the returned `User.onboarding_completed` equals the generated value.

**Property 2 test:** Generate random protected route paths (excluding `/onboarding`). For each, render `AuthGuard` with a user where `onboarding_completed = false` and assert a redirect to `/onboarding` occurs.

**Property 3 test:** For any user with `onboarding_completed = false`, simulate the full onboarding completion flow (mock `profiles.update` success, mock `getCurrentUser` returning `onboarding_completed = true`). Assert that after completion, `AppContext` user has `onboarding_completed = true` and `AuthGuard` renders children instead of redirecting.

### Smoke tests (CI)

- `npx tsc --noEmit` exits 0 after all changes (Req 1.2, 10.6)
- Supabase client config has `detectSessionInUrl: true` (Req 5.2)

# Tasks — mvp-settings

## Task List

- [ ] 1. Verify TypeScript strict mode
  - Read `frontend/tsconfig.json` and confirm `"strict": true` is present
  - If missing, add it and run `npx tsc --noEmit` to surface any pre-existing errors
  - Fix any pre-existing strict-mode errors before proceeding
  - **Files:** `frontend/tsconfig.json`

- [ ] 2. Add Integrations tab to Settings.tsx
  - Extend `Tab` type to include `'integrations'`
  - Add `{ id: 'integrations', label: 'Integrations', icon: <LinkIcon size={16} /> }` to `TABS` array
  - Add `import { useNavigate } from 'react-router-dom'` and `import { LinkIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react'`
  - Add `import { getSocialConnections } from '../services/socialService'` and `import type { SocialConnection } from '../types'`
  - Add `import { reportError } from '../utils/errorReporter'`
  - Implement `IntegrationsTab` component (see design.md) with:
    - `useEffect` that calls `getSocialConnections(user.id)`, sets loading state, and calls `reportError` + `toast.error` on failure
    - Loading skeleton: 6 `animate-pulse` placeholder cards
    - Platform cards showing icon, name, and connected/not-connected status
    - "Manage Connections" button using `useNavigate` to `/social-accounts`
  - Add `{activeTab === 'integrations' && <IntegrationsTab />}` to the tab content switch
  - **Files:** `frontend/src/pages/Settings.tsx`

- [ ] 3. Add inline edit mode to UserProfile.tsx
  - Add state: `isEditing`, `displayName`, `avatarUrl`, `bio`, `phone`, `timezone`, `saving`, `snapshot`
  - Populate state from `getProfile` response on mount (already partially done — extend to cover all fields)
  - Implement `handleEdit` (capture snapshot, set `isEditing = true`)
  - Implement `handleCancel` (restore snapshot, set `isEditing = false`)
  - Implement `handleSave` (call `updateProfile`, update `AppContext` user via `setUser`, show toast, set `isEditing = false`; use `catch (error: unknown)` with `reportError`)
  - Replace the static "Edit Profile" `<Link>` with a button that calls `handleEdit`
  - Render edit form in place when `isEditing === true` with fields: display name, avatar URL, bio, phone, timezone (matching Settings.tsx ProfileTab style)
  - Save button disabled + spinner while `saving === true`
  - Cancel button restores snapshot without network call
  - Add imports: `updateProfile` from `settingsService`, `reportError` from `errorReporter`, `Loader2Icon`, `SaveIcon`, `XIcon` from `lucide-react`, `useAppContext` (already imported), `TIMEZONES` constant (copy from Settings.tsx or extract to shared constant)
  - Remove the `<Link to="/settings">` Edit Profile link
  - **Files:** `frontend/src/pages/profile/UserProfile.tsx`

- [ ] 4. Run type-check and fix any errors
  - Run `npx tsc --noEmit` from `frontend/`
  - Fix all reported errors (no `any`, no missing types, no strict violations)
  - Confirm exit code 0
  - **Files:** any files with type errors

- [ ] 5. Smoke-test the changes
  - Start the dev server and verify:
    - Settings page shows 5 tabs (Profile, Brand, Security, Notifications, Integrations)
    - Integrations tab loads connection status from Supabase and "Manage Connections" navigates to `/social-accounts`
    - UserProfile page shows read-only view by default; clicking "Edit Profile" shows the form; saving updates the displayed name/avatar; cancelling restores previous values
    - No console errors or TypeScript errors
  - **Files:** none (verification only)

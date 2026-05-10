# Requirements — mvp-settings

## Overview

Close PRD gaps #6 and #13: ensure `Settings.tsx` has all five required tabs (profile, brand, security, notifications, **integrations**) and that `UserProfile.tsx` provides a proper profile-edit form. All service calls must use real Supabase endpoints, `reportError` in every catch block, and pass `tsc --noEmit` under strict mode.

---

## Requirements

### 1. Settings Page — Integrations Tab

**1.1** `Settings.tsx` MUST expose a fifth tab labelled **Integrations** with a `LinkIcon` icon, positioned between the Notifications tab and any future tabs.

**1.2** The Integrations tab MUST display a summary card for each of the six supported platforms (Instagram, YouTube, Twitter/X, Facebook, LinkedIn, TikTok) showing:
- Platform icon and name
- Connection status (connected / not connected) sourced from `getSocialConnections` in `socialService`
- A "Manage Connections" button that navigates to `/social-accounts` via React Router `useNavigate`

**1.3** The Integrations tab MUST NOT duplicate the OAuth connection flow — it is a read-only status view with a navigation link.

**1.4** The Integrations tab MUST show a loading skeleton while `getSocialConnections` is in flight and surface a toast error if the fetch fails.

**1.5** The `Tab` union type in `Settings.tsx` MUST be extended to include `'integrations'` and the `TABS` array MUST include the new entry.

---

### 2. Settings Page — Service & Code Quality

**2.1** `settingsService.ts` already calls real Supabase endpoints (`profiles`, `brand_profiles`, `supabase.auth.updateUser`). No mock data or `setTimeout` simulation is permitted.

**2.2** Every `catch` block in `settingsService.ts` MUST use `catch (error: unknown)` and call `reportError` — this is already satisfied; the requirement is to preserve it through any future edits.

**2.3** `npx tsc --noEmit` MUST exit 0 after all changes. No `any` types are permitted in new or modified code.

**2.4** The `NotificationPreferences` toggle values MUST be treated as `boolean` (not `boolean | undefined`) in the toggle handler to avoid strict-mode narrowing errors.

---

### 3. UserProfile Page — Profile Edit Form

**3.1** `UserProfile.tsx` (at `pages/profile/UserProfile.tsx`) MUST be extended with an inline edit mode. When the user clicks **Edit Profile**, the read-only view transitions to an editable form in place (no navigation to `/settings`).

**3.2** The edit form MUST include fields for: display name, avatar URL, bio, phone, and timezone — matching the fields in `Settings.tsx` ProfileTab.

**3.3** Saving the form MUST call `updateProfile` from `settingsService` and update the `AppContext` user object on success, showing a `toast.success` confirmation.

**3.4** Cancelling the edit MUST restore the previous field values without making a network call.

**3.5** The save button MUST be disabled while the request is in-flight and show a spinner.

**3.6** All catch paths in `UserProfile.tsx` MUST use `catch (error: unknown)` and call `reportError`.

---

### 4. TypeScript Strict Mode

**4.1** The `tsconfig.json` in `frontend/` MUST have `"strict": true`. If it is already set, no change is needed; if it is missing, it MUST be added.

**4.2** After all changes, `npx tsc --noEmit` run from `frontend/` MUST exit 0 with no errors.

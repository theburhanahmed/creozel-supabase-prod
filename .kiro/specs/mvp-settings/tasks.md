# Tasks: MVP Settings

- [x] 1. Create settings service
  - [x] 1.1 Create `frontend/src/services/settingsService.ts`
  - [x] 1.2 Implement `getProfile` fetching from profiles table
  - [x] 1.3 Implement `updateProfile` updating profiles table
  - [x] 1.4 Implement `getBrandProfile` and `upsertBrandProfile`
  - [x] 1.5 Implement `updatePassword` via supabase.auth.updateUser

- [x] 2. Build Settings page
  - [x] 2.1 Replace `frontend/src/pages/Settings.tsx` with tabbed implementation
  - [x] 2.2 Add Profile tab (display_name, avatar_url, bio, phone, timezone)
  - [x] 2.3 Add Brand tab (brand_name, logo_url, voice_guidelines, tone_settings)
  - [x] 2.4 Add Security tab (change password form)
  - [x] 2.5 Add Notifications tab (notification_preferences toggles)
  - [x] 2.6 Wire all forms to save via settingsService

- [x] 3. Build UserProfile page
  - [x] 3.1 Replace `frontend/src/pages/profile/UserProfile.tsx` with real implementation
  - [x] 3.2 Show user avatar, display_name, email, bio
  - [x] 3.3 Add edit profile button linking to Settings

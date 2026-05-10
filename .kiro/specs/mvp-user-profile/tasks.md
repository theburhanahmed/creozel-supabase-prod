# Tasks — mvp-user-profile

- [ ] 1. Add inline edit state to `UserProfile.tsx`
  - Add `isEditing`, `displayName`, `avatarUrl`, `bio`, `phone`, `timezone`, `saving`, `snapshot` state
  - Populate state from `getProfile` response on mount
  - **Validates:** Requirement 1.1

- [ ] 2. Implement edit/save/cancel handlers
  - `handleEdit`: capture snapshot, set `isEditing = true`
  - `handleCancel`: restore snapshot, set `isEditing = false`
  - `handleSave`: call `updateProfile`, update `AppContext` user via `setUser`, show toast, set `isEditing = false`
  - Use `catch (error: unknown)` with `reportError` in `handleSave`
  - **Validates:** Requirements 1.3–1.6

- [ ] 3. Replace `<Link to="/settings">` with edit button
  - Remove the `<Link to="/settings">Edit Profile</Link>` element
  - Replace with `<button onClick={handleEdit}>Edit Profile</button>`
  - **Validates:** Requirements 2.1–2.2

- [ ] 4. Render edit form in place
  - When `isEditing === true`, render form with fields: display name, avatar URL, bio, phone, timezone
  - Save button disabled + spinner while `saving === true`
  - Cancel button restores snapshot
  - Match the visual style of `Settings.tsx` ProfileTab
  - **Validates:** Requirements 1.2, 1.4, 1.5

- [ ] 5. TypeScript strict mode verification
  - Run `npx tsc --noEmit` from `frontend/`
  - Fix any errors in `UserProfile.tsx`
  - **Validates:** Requirement 3.1

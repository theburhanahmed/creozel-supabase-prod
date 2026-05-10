# Requirements — mvp-user-profile

## Introduction

The `UserProfile.tsx` page is a read-only view that links to `/settings` for editing. The PRD requires a profile edit form. This spec adds an inline edit mode to `UserProfile.tsx`.

## Glossary

- **UserProfile**: Page at `frontend/src/pages/profile/UserProfile.tsx`
- **settingsService**: Service at `frontend/src/services/settingsService.ts`

## Requirements

### Requirement 1 — Inline Edit Mode

**User Story:** As a user, I want to edit my profile directly on the profile page without navigating to Settings.

#### Acceptance Criteria

1. THE `UserProfile` page SHALL render an "Edit Profile" button that, when clicked, transitions the view to an editable form in place.
2. THE edit form SHALL include fields for: display name, avatar URL, bio, phone, and timezone.
3. WHEN the user clicks "Save", THE page SHALL call `updateProfile` from `settingsService` and update `AppContext.user` on success.
4. WHEN the user clicks "Cancel", THE page SHALL restore the previous field values without making a network call.
5. THE save button SHALL be disabled while the request is in-flight and show a spinner.
6. ALL catch paths SHALL use `catch (error: unknown)` with `reportError`.

### Requirement 2 — Remove Settings Link for Edit

**User Story:** As a user, I want the "Edit Profile" button to open the inline form, not navigate to Settings.

#### Acceptance Criteria

1. THE `UserProfile` page SHALL NOT use a `<Link to="/settings">` for the "Edit Profile" action.
2. THE "Edit Profile" button SHALL be a `<button>` element that sets `isEditing = true`.

### Requirement 3 — TypeScript Strict Mode

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed, THE TypeScript compiler SHALL exit with code 0 with no errors in `UserProfile.tsx`.

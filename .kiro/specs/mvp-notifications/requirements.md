# Requirements — mvp-notifications

## Introduction

The Notifications page (`Notifications.tsx`) is fully implemented with Supabase Realtime subscription, mark-as-read, and mark-all-read functionality. The remaining gaps are: verifying the `notificationService.ts` is wired to real Supabase endpoints, ensuring the Realtime subscription is properly cleaned up on unmount, and TypeScript strict mode compliance.

## Glossary

- **Notifications**: Page at `frontend/src/pages/notifications/Notifications.tsx`
- **notificationService**: Service at `frontend/src/services/notificationService.ts`
- **Supabase Realtime**: WebSocket-based subscription for live `notifications` table changes

## Requirements

### Requirement 1 — Real-time Notification Feed

**User Story:** As a user, I want to see new notifications appear instantly without refreshing the page.

#### Acceptance Criteria

1. THE `Notifications` page SHALL subscribe to `notifications` table INSERT events via `supabase.channel()` on mount.
2. WHEN a new notification is inserted for the authenticated user, THE page SHALL prepend it to the notification list without a full reload.
3. THE Realtime subscription SHALL be unsubscribed when the component unmounts (cleanup function returned from `useEffect`).
4. THE `subscribeToNotifications` function in `notificationService` SHALL filter events by `user_id = auth.uid()` to prevent cross-user data leakage.

### Requirement 2 — Mark as Read

**User Story:** As a user, I want to mark individual notifications as read.

#### Acceptance Criteria

1. WHEN the user clicks the mark-as-read button on a notification, THE page SHALL call `markAsRead(id)` which issues a PostgREST PATCH setting `is_read = true`.
2. AFTER a successful PATCH, THE page SHALL update the local state to reflect `is_read = true` without a full reload.
3. THE `markAllAsRead` function SHALL issue a PostgREST PATCH setting `is_read = true` for all notifications where `user_id = auth.uid()`.

### Requirement 3 — TypeScript Strict Mode

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed, THE TypeScript compiler SHALL exit with code 0 with no errors in `Notifications.tsx` or `notificationService.ts`.
2. ALL `catch` blocks SHALL use `catch (error: unknown)` with `reportError`.

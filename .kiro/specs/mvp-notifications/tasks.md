# Tasks — mvp-notifications

- [ ] 1. Verify `notificationService.ts` is wired to real Supabase endpoints
  - Confirm `getNotifications`, `markAsRead`, `markAllAsRead`, `subscribeToNotifications` all use `supabase` client
  - Confirm no mock data or hardcoded arrays
  - Confirm `subscribeToNotifications` returns an unsubscribe function
  - **Validates:** Requirements 1.1–1.4, 2.1–2.3

- [ ] 2. Verify Realtime subscription cleanup in `Notifications.tsx`
  - Confirm the `useEffect` that calls `subscribeToNotifications` returns the unsubscribe function
  - If missing, add `return unsub` to the `useEffect` cleanup
  - **Validates:** Requirement 1.3

- [ ] 3. TypeScript strict mode verification
  - Run `npx tsc --noEmit` from `frontend/`
  - Fix any errors in `Notifications.tsx` and `notificationService.ts`
  - Confirm all `catch` blocks use `catch (error: unknown)` with `reportError`
  - **Validates:** Requirements 3.1–3.2

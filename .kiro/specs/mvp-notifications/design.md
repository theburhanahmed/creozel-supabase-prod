# Design — mvp-notifications

## Overview

The Notifications page is fully implemented. The design documents the existing architecture and identifies the cleanup verification needed.

## Architecture

```
Notifications.tsx
  ├── getNotifications(userId)          → supabase.from('notifications').select('*').eq('user_id', userId)
  ├── subscribeToNotifications(userId)  → supabase.channel('notifications:userId')
  │                                         .on('postgres_changes', { filter: 'user_id=eq.userId' })
  │                                         → prepend new notification to state
  │                                         → returns unsubscribe function
  ├── markAsRead(id)                    → supabase.from('notifications').update({ is_read: true }).eq('id', id)
  └── markAllAsRead(userId)             → supabase.from('notifications').update({ is_read: true }).eq('user_id', userId)
```

## Realtime Subscription Pattern

```typescript
// In notificationService.ts
export function subscribeToNotifications(
  userId: string,
  onNew: (n: Notification) => void,
): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNew(payload.new as Notification),
    )
    .subscribe()

  return () => { void supabase.removeChannel(channel) }
}
```

## Correctness Properties

- **Subscription cleanup**: The unsubscribe function returned by `subscribeToNotifications` must be called when the component unmounts.
- **User isolation**: The Realtime filter `user_id=eq.${userId}` ensures only the authenticated user's notifications are received.
- **Optimistic update**: `markAsRead` updates local state immediately after the PATCH succeeds, without re-fetching the full list.

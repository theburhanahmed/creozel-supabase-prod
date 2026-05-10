# Design — mvp-user-profile

## Overview

`UserProfile.tsx` is a read-only view. The spec adds an inline edit mode. The design is identical to the `mvp-settings` spec's UserProfile section.

## Architecture

```
UserProfile.tsx
  ├── getProfile(userId)     → supabase.from('profiles').select('*').eq('id', userId)
  ├── [isEditing = false]    → read-only view with "Edit Profile" button
  └── [isEditing = true]     → edit form with Save/Cancel buttons
        └── updateProfile(userId, fields)  → supabase.from('profiles').update(...)
              → setUser(updated)           → AppContext refresh
```

## State

```typescript
const [isEditing, setIsEditing]     = useState(false)
const [displayName, setDisplayName] = useState(user?.display_name ?? '')
const [avatarUrl, setAvatarUrl]     = useState(user?.avatar_url ?? '')
const [bio, setBio]                 = useState(user?.bio ?? '')
const [phone, setPhone]             = useState(user?.phone ?? '')
const [timezone, setTimezone]       = useState(user?.timezone ?? 'UTC')
const [saving, setSaving]           = useState(false)
const [snapshot, setSnapshot]       = useState({ displayName, avatarUrl, bio, phone, timezone })
```

## Correctness Properties

- **Cancel is lossless**: Cancelling always restores the exact pre-edit values with no network call.
- **Save updates context**: After a successful save, `AppContext.user` reflects the new values immediately.
- **No navigation on edit**: The edit form renders in-place; no redirect to `/settings`.

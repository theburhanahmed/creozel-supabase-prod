# Design — mvp-settings

## Overview

Two files need changes: `Settings.tsx` (add Integrations tab) and `pages/profile/UserProfile.tsx` (add inline edit form). One file needs verification: `tsconfig.json` strict mode. No new services, no new routes, no schema changes.

---

## Architecture

### Affected Files

| File | Change |
|---|---|
| `frontend/src/pages/Settings.tsx` | Add `IntegrationsTab` component + extend `Tab` type + `TABS` array |
| `frontend/src/pages/profile/UserProfile.tsx` | Add inline edit mode with form fields |
| `frontend/tsconfig.json` | Verify `"strict": true` is present |

### No Changes Needed

- `settingsService.ts` — already correct (real Supabase, `reportError`, `catch (error: unknown)`)
- `errorReporter.ts` — already exists and is imported
- `socialService.ts` — reused as-is for the Integrations tab status fetch
- `App.tsx` / routing — no new routes required

---

## Component Design

### 1. IntegrationsTab (new component in Settings.tsx)

```tsx
// Placement: after NotificationsTab, before the Settings export
const IntegrationsTab: React.FC = () => {
  const { user } = useAppContext()
  const navigate = useNavigate()
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getSocialConnections(user.id)
      .then(setConnections)
      .catch((error: unknown) => {
        reportError('IntegrationsTab.load', error)
        toast.error('Failed to load connected accounts')
      })
      .finally(() => setLoading(false))
  }, [user])

  // Render: loading skeleton → platform cards → "Manage Connections" button
}
```

**Platform card layout** (mirrors `SocialAccounts.tsx` style):
- Platform gradient icon + name on the left
- `CheckCircleIcon` (green) or `AlertCircleIcon` (gray) on the right
- "Manage Connections" button at the bottom navigates to `/social-accounts`

**Loading skeleton**: 6 placeholder cards with `animate-pulse` matching the card dimensions.

### 2. Tab type extension (Settings.tsx)

```tsx
// Before
type Tab = 'profile' | 'brand' | 'security' | 'notifications'

// After
type Tab = 'profile' | 'brand' | 'security' | 'notifications' | 'integrations'

// TABS array addition
{ id: 'integrations', label: 'Integrations', icon: <LinkIcon size={16} /> }
```

Tab content switch addition:
```tsx
{activeTab === 'integrations' && <IntegrationsTab />}
```

### 3. UserProfile inline edit mode

State additions:
```tsx
const [isEditing, setIsEditing]         = useState(false)
const [displayName, setDisplayName]     = useState(user?.display_name ?? '')
const [avatarUrl, setAvatarUrl]         = useState(user?.avatar_url ?? '')
const [bio, setBio]                     = useState(user?.bio ?? '')
const [phone, setPhone]                 = useState(user?.phone ?? '')
const [timezone, setTimezone]           = useState(user?.timezone ?? 'UTC')
const [saving, setSaving]               = useState(false)
// Snapshot for cancel
const [snapshot, setSnapshot]           = useState({ displayName, avatarUrl, bio, phone, timezone })
```

Edit flow:
1. "Edit Profile" button sets `isEditing = true` and captures a snapshot of current values.
2. Form renders in place of the read-only view (same card, same layout).
3. Save calls `updateProfile`, updates `AppContext` user, shows `toast.success`, sets `isEditing = false`.
4. Cancel restores snapshot values, sets `isEditing = false`, no network call.

```tsx
const handleEdit = () => {
  setSnapshot({ displayName, avatarUrl, bio, phone, timezone })
  setIsEditing(true)
}

const handleCancel = () => {
  setDisplayName(snapshot.displayName)
  setAvatarUrl(snapshot.avatarUrl)
  setBio(snapshot.bio)
  setPhone(snapshot.phone)
  setTimezone(snapshot.timezone)
  setIsEditing(false)
}

const handleSave = async () => {
  if (!user) return
  setSaving(true)
  try {
    const ok = await updateProfile(user.id, { display_name: displayName, avatar_url: avatarUrl, bio, phone, timezone })
    if (ok) {
      setUser({ ...user, display_name: displayName, avatar_url: avatarUrl, bio, phone, timezone })
      toast.success('Profile updated')
      setIsEditing(false)
    } else {
      toast.error('Failed to update profile')
    }
  } catch (error: unknown) {
    reportError('UserProfile.handleSave', error)
    toast.error('Failed to update profile')
  } finally {
    setSaving(false)
  }
}
```

---

## Data Flow

### Integrations Tab

```
IntegrationsTab mounts
  → getSocialConnections(user.id)          [socialService → supabase.from('social_connections')]
  → setConnections(data)
  → render platform cards with status
  → "Manage Connections" → navigate('/social-accounts')
```

### UserProfile Edit

```
User clicks "Edit Profile"
  → snapshot captured, isEditing = true
  → form renders with current values

User clicks "Save"
  → updateProfile(userId, fields)          [settingsService → supabase.from('profiles').update()]
  → setUser(updated)                       [AppContext]
  → toast.success / toast.error
  → isEditing = false

User clicks "Cancel"
  → restore snapshot values
  → isEditing = false
```

---

## TypeScript Strict Mode

Check `frontend/tsconfig.json` for `"strict": true`. The `NotificationPreferences` fields are typed as `boolean | undefined` — the toggle handler must use a nullish coalesce to avoid strict narrowing issues:

```tsx
// Safe toggle
const toggle = (key: keyof NotificationPreferences) => {
  setPrefs((p) => ({ ...p, [key]: !(p[key] ?? false) }))
}
```

This is already correct in the current `Settings.tsx` implementation. No change needed unless `tsc --noEmit` reports an error.

---

## Imports Required

**Settings.tsx additions:**
```tsx
import { useNavigate } from 'react-router-dom'
import { LinkIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react'
import { getSocialConnections } from '../services/socialService'
import type { SocialConnection } from '../types'
import { reportError } from '../utils/errorReporter'
```

**UserProfile.tsx additions:**
```tsx
import { updateProfile } from '../../services/settingsService'
import { reportError } from '../../utils/errorReporter'
import { Loader2Icon, SaveIcon, XIcon } from 'lucide-react'
// Remove: import { Link } from 'react-router-dom' (no longer needed for Edit Profile)
// Keep: useAppContext, getProfile
```

---

## Correctness Properties

- **Integrations tab status is live**: connection status reflects `social_connections` table, not hardcoded values.
- **Edit cancel is lossless**: cancelling edit always restores the exact pre-edit values with no network call.
- **Save updates context**: after a successful save, `AppContext.user` reflects the new values immediately without a page reload.
- **Error paths are covered**: both the Integrations fetch and the UserProfile save have `reportError` in their catch paths.
- **No TypeScript `any`**: all new code uses explicit types or `unknown` in catch blocks.

# Design Document — mvp-calendar

## Overview

The `mvp-calendar` feature wires the existing `Calendar.tsx` page to live Supabase data. The component already renders a FullCalendar grid with a post-detail modal and drag-and-drop support; the remaining work closes four gaps:

1. **Team-scoped loading** — pass `teamId` (derived from `AppContext.user.id`) to `CalendarService.getScheduledPosts()`.
2. **Date-range–scoped loading** — use FullCalendar's `datesSet` callback to fetch only posts in the visible window.
3. **Error reporting** — forward reschedule failures to `reportError` (Sentry) in addition to the existing `toast.error`.
4. **Memoised `datesSet` handler** — wrap the callback in `useCallback` so FullCalendar does not receive a new function reference on every render.

All changes are confined to `frontend/src/pages/Calendar.tsx` and `frontend/src/services/calendarService.ts`. No new dependencies are required; all libraries (`@fullcalendar/*`, `sonner`, `lucide-react`, `@supabase/supabase-js`) are already installed.

---

## Architecture

```
AppContext
  └─ user: User | null
       └─ user.id  ──────────────────────────────────────────────┐
                                                                  ▼
Calendar.tsx                                          CalendarService.getScheduledPosts(
  ├─ useAppContext()  →  user                           teamId?,
  ├─ useCallback(handleDatesSet, [teamId])              startDate?,
  │    └─ fires on view change / navigation             endDate?
  ├─ useCallback(handleEventClick, [])               )
  ├─ useCallback(handleEventDrop, [])                    │
  └─ FullCalendar                                        ▼
       ├─ datesSet={handleDatesSet}              supabase
       ├─ eventClick={handleEventClick}            .from('scheduled_posts')
       ├─ eventDrop={handleEventDrop}              .select('*')
       ├─ editable={true}                          .eq('team_id', teamId)      ← new
       └─ droppable={true}                         .gte('scheduled_at', start) ← new
                                                   .lte('scheduled_at', end)   ← new
                                                   .order('scheduled_at', asc)
```

### Data flow

```
Mount / teamId change
  → handleDatesSet fires (FullCalendar always fires datesSet on mount)
  → getScheduledPosts(teamId, startStr, endStr)
  → PostgREST query with team + date filters
  → setPosts(data)
  → events[] derived from posts
  → FullCalendar renders events

Drag-and-drop
  → handleEventDrop
  → reschedulePost(postId, newISODate)
  → PostgREST PATCH scheduled_posts
  → success: setPosts(updated), toast.success
  → failure: info.revert(), toast.error, reportError
```

---

## Components

### `Calendar` (page component — `Calendar.tsx`)

**State**

| State variable | Type | Purpose |
|---|---|---|
| `posts` | `ScheduledPost[]` | Current event list |
| `loading` | `boolean` | Controls spinner / skeleton |
| `error` | `string \| null` | Surfaces fetch errors |
| `selectedPost` | `ScheduledPost \| null` | Drives `PostModal` visibility |

**Derived values**

- `teamId: string | undefined` — derived as `user?.id` from `useAppContext()`. Used as the PostgREST `team_id` filter.
- `events: EventInput[]` — memoised mapping of `posts` to FullCalendar event objects (already implemented; no changes needed).

**Hooks**

```typescript
const { user } = useAppContext()
const teamId = user?.id  // undefined while auth is loading
```

**`handleDatesSet` (new)**

```typescript
const handleDatesSet = useCallback(
  (dateInfo: DatesSetArg) => {
    if (!teamId) return
    void loadPosts(teamId, dateInfo.startStr, dateInfo.endStr)
  },
  [teamId],  // re-creates only when teamId changes
)
```

- Replaces the current `useEffect`-based `loadPosts()` call on mount.
- FullCalendar fires `datesSet` on mount, so the initial load is covered automatically.
- The existing `loadPosts` function is refactored to accept `(teamId, startDate, endDate)` parameters.

**`loadPosts` (refactored)**

```typescript
const loadPosts = useCallback(
  async (teamId: string, startDate: string, endDate: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getScheduledPosts(teamId, startDate, endDate)
      setPosts(data)
    } catch (error: unknown) {
      reportError('Calendar.loadPosts', error, { teamId, startDate, endDate })
      setError('Failed to load scheduled posts.')
    } finally {
      setLoading(false)
    }
  },
  [],
)
```

**`handleEventDrop` (updated)**

```typescript
const handleEventDrop = useCallback(async (info: EventDropArg) => {
  const post = info.event.extendedProps.post as ScheduledPost
  const newDate = info.event.start

  if (!newDate) {
    info.revert()
    return
  }

  const updated = await reschedulePost(post.id, newDate.toISOString())
  if (!updated) {
    info.revert()
    reportError('Calendar.handleEventDrop', new Error('reschedulePost returned null'), {
      postId: post.id,
      attemptedDate: newDate.toISOString(),
    })
    toast.error('Failed to reschedule post')
  } else {
    toast.success('Post rescheduled')
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, scheduled_at: newDate.toISOString() } : p,
      ),
    )
  }
}, [])
```

Key changes from the current implementation:
- `reportError` is called before `toast.error` (after `info.revert()`).
- Structured context `{ postId, attemptedDate }` is passed as the third argument.
- No `console.error` remains in this path.

**FullCalendar props (updated)**

```tsx
<FullCalendar
  ref={calendarRef}
  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
  initialView="dayGridMonth"
  headerToolbar={{
    left:   'prev,next today',
    center: 'title',
    right:  'dayGridMonth,timeGridWeek,timeGridDay',
  }}
  datesSet={handleDatesSet}   {/* ← new */}
  events={events}
  editable={true}
  droppable={true}
  eventClick={handleEventClick}
  eventDrop={handleEventDrop}
  height="auto"
  eventDisplay="block"
  dayMaxEvents={3}
  moreLinkClick="popover"
  nowIndicator={true}
  buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
  eventContent={(arg) => (
    <div className="px-1 py-0.5 truncate text-xs font-medium">
      {arg.event.title}
    </div>
  )}
/>
```

The existing `useEffect(() => { void loadPosts() }, [loadPosts])` is **removed**; `datesSet` handles the initial load.

---

### `PostModal` (sub-component — unchanged)

No changes required. The modal already satisfies all display requirements (platform icon, formatted date, status badge, content, media links, error panel).

---

### `CalendarService` (`calendarService.ts`)

**`getScheduledPosts` (updated signature)**

```typescript
export async function getScheduledPosts(
  teamId?: string,
  startDate?: string,
  endDate?: string,
): Promise<ScheduledPost[]>
```

The function already accepts all three optional parameters and applies the filters. The only change needed is ensuring the `teamId` filter is applied when provided (already implemented). No signature change is required — the existing implementation is correct.

**`reschedulePost` (unchanged)**

```typescript
export async function reschedulePost(
  postId: string,
  newScheduledAt: string,
): Promise<ScheduledPost | null>
```

No changes required.

---

## Data Models

All data models are already defined in `frontend/src/types/index.ts`. No new types are needed.

**Relevant existing types:**

```typescript
// ScheduledPost — maps 1:1 to the scheduled_posts PostgREST table
interface ScheduledPost {
  id: string
  user_id: string
  team_id?: string
  content: string
  platform: SocialPlatform   // 'instagram' | 'youtube' | 'twitter' | 'facebook' | 'linkedin' | 'tiktok'
  scheduled_at: string       // ISO 8601 timestamptz
  status: PostStatus         // 'draft' | 'scheduled' | 'published' | 'failed'
  media_urls: string[]
  error_message?: string
  social_connection_id?: string
  created_at: string
  updated_at: string
}
```

**FullCalendar event shape (derived, not stored):**

```typescript
// Derived in Calendar.tsx — not a stored type
{
  id:              post.id,
  title:           `${platform.label}: ${post.content.slice(0, 30)}…`,
  start:           post.scheduled_at,
  backgroundColor: post.status === 'failed' ? '#ef4444' : platform.color,
  borderColor:     post.status === 'failed' ? '#ef4444' : platform.color,
  textColor:       '#ffffff',
  extendedProps:   { post },
}
```

---

## Interfaces

### `CalendarService` public API

```typescript
// Returns posts filtered by team and/or date range
getScheduledPosts(teamId?: string, startDate?: string, endDate?: string): Promise<ScheduledPost[]>

// PATCH scheduled_at for a single post; returns updated row or null on failure
reschedulePost(postId: string, newScheduledAt: string): Promise<ScheduledPost | null>

// Fetch a single post by ID (used by PostModal if needed in future)
getPostDetail(postId: string): Promise<ScheduledPost | null>
```

### FullCalendar callback types (from `@fullcalendar/core`)

```typescript
import type { DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core'

// datesSet callback argument
interface DatesSetArg {
  start: Date
  end: Date
  startStr: string   // ISO 8601 — passed as startDate to getScheduledPosts
  endStr: string     // ISO 8601 — passed as endDate to getScheduledPosts
  timeZone: string
  view: ViewApi
}
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| `getScheduledPosts` throws or returns error | `catch (error: unknown)` → `reportError('Calendar.loadPosts', error, { teamId, startDate, endDate })` → `setError('Failed to load scheduled posts.')` → retry button visible |
| `reschedulePost` returns `null` | `info.revert()` → `reportError('Calendar.handleEventDrop', error, { postId, attemptedDate })` → `toast.error('Failed to reschedule post')` |
| `info.event.start` is `null` after drop | `info.revert()` immediately, no service call |
| `user` is `null` in AppContext | `handleDatesSet` returns early without calling `getScheduledPosts`; loading state shown until user is available |
| Network error during reschedule | Caught in `calendarService.reschedulePost` via `try/catch (error: unknown)`, forwarded via `reportError`, returns `null` to caller |

All `catch` blocks use `catch (error: unknown)` — no `catch (error: any)` is permitted. `console.error` is not used anywhere in the Calendar or CalendarService; all errors go through `reportError`.

---

## TypeScript Strict-Mode Compliance

The following patterns are enforced to satisfy `npx tsc --noEmit` with `"strict": true`:

1. **`catch (error: unknown)`** in all try/catch blocks in both files.
2. **Explicit return types** on all `CalendarService` functions (`Promise<ScheduledPost[]>`, `Promise<ScheduledPost | null>`).
3. **`as ScheduledPost` cast** when reading `info.event.extendedProps.post` in `handleEventClick` and `handleEventDrop`.
4. **Null guard on `user`** — `teamId` is derived as `user?.id` (type `string | undefined`); `handleDatesSet` returns early when `teamId` is `undefined`.
5. **`DatesSetArg` import** — imported from `@fullcalendar/core` to type the `datesSet` callback parameter.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Team filter is always applied

*For any* non-empty `teamId` string, calling `getScheduledPosts(teamId)` must produce a PostgREST query that includes an `eq('team_id', teamId)` filter, ensuring posts from other teams are never returned.

**Validates: Requirements 1.1, 1.4**

---

### Property 2: Date range filters are applied when provided

*For any* valid ISO 8601 date string pair `(startDate, endDate)`, calling `getScheduledPosts(undefined, startDate, endDate)` must produce a query that includes `.gte('scheduled_at', startDate)` and `.lte('scheduled_at', endDate)`, ensuring only posts within the visible window are fetched.

**Validates: Requirements 2.1, 2.3**

---

### Property 3: datesSet handler is referentially stable across unrelated re-renders

*For any* re-render of the Calendar component caused by a state change that does not affect `teamId` (e.g. `selectedPost` changes, `loading` changes), the `handleDatesSet` function reference passed to FullCalendar's `datesSet` prop must remain the same object reference as before the re-render.

**Validates: Requirements 2.2, 4.1, 4.2**

---

### Property 4: Reschedule failure always triggers reportError with structured context

*For any* `(postId, attemptedDate)` pair where `reschedulePost` returns `null`, the `handleEventDrop` handler must call `reportError` with location `'Calendar.handleEventDrop'` and a context object containing both `postId` and `attemptedDate` before displaying the error toast.

**Validates: Requirements 3.1, 3.4, 8.3**

---

### Property 5: Platform colour is applied to all non-failed events

*For any* `ScheduledPost` with `status !== 'failed'`, the corresponding FullCalendar event's `backgroundColor` must equal `PLATFORM_CONFIG[post.platform].color`.

**Validates: Requirements 6.1**

---

### Property 6: Failed posts always render red regardless of platform

*For any* `ScheduledPost` with `status === 'failed'`, the corresponding FullCalendar event's `backgroundColor` must be `'#ef4444'`, regardless of the post's `platform` value.

**Validates: Requirements 6.2**

---

### Property 7: PostModal renders all required fields for any post

*For any* `ScheduledPost`, rendering `PostModal` must produce output that contains the platform label, a human-readable representation of `scheduled_at`, the post `status`, and the full `content` text.

**Validates: Requirements 7.2**

---

### Property 8: PostModal renders exactly N media links for N media URLs

*For any* `ScheduledPost` where `media_urls` has length N > 0, rendering `PostModal` must produce exactly N anchor elements labelled "Media 1" through "Media N".

**Validates: Requirements 7.3**

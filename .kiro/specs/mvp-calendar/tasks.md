# Implementation Plan: mvp-calendar

## Overview

Wire `Calendar.tsx` to live Supabase data by closing four targeted gaps: team-scoped loading via `AppContext`, date-range–scoped loading via FullCalendar's `datesSet` callback, `reportError` forwarding on reschedule failure, and a memoised `datesSet` handler. `calendarService.ts` is already fully implemented and requires no changes. All work is confined to `frontend/src/pages/Calendar.tsx`.

## Tasks

- [ ] 1. Wire `useAppContext` and derive `teamId` in `Calendar.tsx`
  - [ ] 1.1 Import `useAppContext` from `../context/AppContext` and call it inside the `Calendar` component to obtain `user`
    - Derive `teamId` as `user?.id` (type `string | undefined`)
    - Remove any existing `useEffect`-based `loadPosts()` call — it will be replaced in task 2
    - _Requirements: 1.1, 1.2, 1.3, 5.5_

  - [ ]* 1.2 Write unit tests for `teamId` derivation behaviour
    - Test that `teamId` is `undefined` when `user` is `null`
    - Test that `teamId` equals `user.id` when `user` is non-null
    - _Requirements: 1.2_

- [ ] 2. Refactor `loadPosts` and add `handleDatesSet` with `useCallback`
  - [ ] 2.1 Refactor `loadPosts` to accept `(teamId: string, startDate: string, endDate: string)` parameters
    - Update the `getScheduledPosts` call inside `loadPosts` to forward all three arguments
    - Wrap `loadPosts` in `useCallback` with an empty dependency array `[]` (it closes over no state — all inputs are parameters)
    - Add `reportError('Calendar.loadPosts', error, { teamId, startDate, endDate })` in the `catch` block (replace the bare `catch {}`)
    - Import `reportError` from `../utils/errorReporter` if not already imported
    - _Requirements: 1.1, 1.4, 2.1, 2.3, 3.2, 5.1, 5.2_

  - [ ] 2.2 Add `handleDatesSet` using `useCallback` and wire it to FullCalendar
    - Import `DatesSetArg` from `@fullcalendar/core`
    - Declare `handleDatesSet` with `useCallback((dateInfo: DatesSetArg) => { if (!teamId) return; void loadPosts(teamId, dateInfo.startStr, dateInfo.endStr) }, [teamId, loadPosts])`
    - Add `datesSet={handleDatesSet}` to the `<FullCalendar>` props
    - Remove the `useEffect(() => { void loadPosts() }, [loadPosts])` block — `datesSet` fires on mount and covers the initial load
    - Remove the `useEffect` import if it is no longer used elsewhere
    - _Requirements: 2.1, 2.2, 2.4, 4.1, 4.2, 4.3, 9.3_

  - [ ]* 2.3 Write property test for `handleDatesSet` referential stability (Property 3)
    - **Property 3: datesSet handler is referentially stable across unrelated re-renders**
    - **Validates: Requirements 2.2, 4.1, 4.2**
    - Render `Calendar` and capture the `handleDatesSet` reference; trigger a `selectedPost` state change; assert the reference is unchanged
    - _Requirements: 2.2, 4.1, 4.2_

  - [ ]* 2.4 Write property tests for `getScheduledPosts` query filters (Properties 1 & 2)
    - **Property 1: Team filter is always applied** — for any non-empty `teamId`, the PostgREST query must include `eq('team_id', teamId)`
    - **Validates: Requirements 1.1, 1.4**
    - **Property 2: Date range filters are applied when provided** — for any valid ISO 8601 `(startDate, endDate)` pair, the query must include `.gte` and `.lte` filters
    - **Validates: Requirements 2.1, 2.3**
    - Mock `supabase.from` and assert the chained filter calls
    - _Requirements: 1.1, 1.4, 2.1, 2.3_

- [ ] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add `reportError` to `handleEventDrop` failure path
  - [ ] 4.1 Update `handleEventDrop` to call `reportError` before `toast.error` when `reschedulePost` returns `null`
    - After `info.revert()`, call `reportError('Calendar.handleEventDrop', new Error('reschedulePost returned null'), { postId: post.id, attemptedDate: newDate.toISOString() })`
    - Then call `toast.error('Failed to reschedule post')`
    - Ensure no `console.error` remains in this path
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.3_

  - [ ]* 4.2 Write property test for reschedule failure error reporting (Property 4)
    - **Property 4: Reschedule failure always triggers reportError with structured context**
    - **Validates: Requirements 3.1, 3.4, 8.3**
    - For any `(postId, attemptedDate)` pair where `reschedulePost` returns `null`, assert `reportError` is called with location `'Calendar.handleEventDrop'` and context containing both `postId` and `attemptedDate`
    - _Requirements: 3.1, 3.4, 8.3_

- [ ] 5. Verify TypeScript strict-mode compliance
  - [ ] 5.1 Run `npx tsc --noEmit` and fix any type errors in `Calendar.tsx` and `calendarService.ts`
    - Confirm all `catch` blocks use `catch (error: unknown)` — no `catch (error: any)`
    - Confirm `as ScheduledPost` casts are present in `handleEventClick` and `handleEventDrop`
    - Confirm `DatesSetArg` is imported from `@fullcalendar/core`
    - Confirm `teamId` null guard is in place in `handleDatesSet`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6. Verify event colour rendering
  - [ ] 6.1 Confirm the `events` derived array applies `PLATFORM_CONFIG[post.platform].color` for non-failed posts and `#ef4444` for failed posts
    - No code change expected — this is already implemented; verify it matches the design spec
    - _Requirements: 6.1, 6.2_

  - [ ]* 6.2 Write property tests for event colour derivation (Properties 5 & 6)
    - **Property 5: Platform colour is applied to all non-failed events** — for any `ScheduledPost` with `status !== 'failed'`, `backgroundColor` must equal `PLATFORM_CONFIG[post.platform].color`
    - **Validates: Requirements 6.1**
    - **Property 6: Failed posts always render red regardless of platform** — for any `ScheduledPost` with `status === 'failed'`, `backgroundColor` must be `'#ef4444'`
    - **Validates: Requirements 6.2**
    - _Requirements: 6.1, 6.2_

- [ ] 7. Verify PostModal rendering
  - [ ] 7.1 Confirm `PostModal` renders platform label/icon, formatted `scheduled_at`, status badge, content, media links, and error panel
    - No code change expected — verify against design spec
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 7.2 Write property tests for PostModal output (Properties 7 & 8)
    - **Property 7: PostModal renders all required fields for any post** — for any `ScheduledPost`, output must contain platform label, human-readable `scheduled_at`, status, and full `content`
    - **Validates: Requirements 7.2**
    - **Property 8: PostModal renders exactly N media links for N media URLs** — for any `ScheduledPost` where `media_urls.length === N > 0`, output must contain exactly N anchor elements labelled "Media 1" through "Media N"
    - **Validates: Requirements 7.3**
    - _Requirements: 7.2, 7.3_

- [ ] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `calendarService.ts` is already fully implemented — no changes needed there
- The `Refresh` button in the header calls `loadPosts` directly; after the refactor it will need the current `teamId` and visible date range. The simplest approach is to call `calendarRef.current?.getApi().refetchEvents()` or re-trigger `handleDatesSet` via the FullCalendar API — address this in task 2.2
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "1.2"] },
    { "id": 2, "tasks": ["2.2", "2.4"] },
    { "id": 3, "tasks": ["2.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["6.1", "7.1"] },
    { "id": 6, "tasks": ["6.2", "7.2"] }
  ]
}
```

# Requirements Document

## Introduction

The `mvp-calendar` feature completes the Content Calendar page (`Calendar.tsx`) in the Creozel frontend. The component is largely implemented using FullCalendar v6; the remaining work closes four wiring gaps and verifies TypeScript strict-mode compliance. When complete, the Calendar will load real scheduled posts from the `scheduled_posts` PostgREST table scoped to the active team and visible date range, display them colour-coded by platform and status, allow drag-and-drop rescheduling, and surface a post-detail modal on click — with all errors forwarded to the centralised `reportError` utility and Sentry.

---

## Glossary

- **Calendar**: The `Calendar` React component in `frontend/src/pages/Calendar.tsx`
- **CalendarService**: The service module at `frontend/src/services/calendarService.ts` that wraps PostgREST calls for `scheduled_posts`
- **AppContext**: The React context provided by `AppProvider` in `frontend/src/context/AppContext.tsx`; exposes the authenticated `user` object
- **teamId**: The `team_id` string derived from `user.id` or the active team membership; used to scope PostgREST queries via `eq('team_id', teamId)`
- **ScheduledPost**: The TypeScript interface in `frontend/src/types/index.ts` representing a row in the `scheduled_posts` table
- **PostStatus**: The union type `'draft' | 'scheduled' | 'published' | 'failed'` defined in `frontend/src/types/index.ts`
- **SocialPlatform**: The union type `'instagram' | 'youtube' | 'twitter' | 'facebook' | 'linkedin' | 'tiktok'` defined in `frontend/src/types/index.ts`
- **FullCalendar**: The `@fullcalendar/react` v6 component used to render the calendar grid
- **datesSet callback**: The FullCalendar `datesSet` prop callback, fired whenever the visible date range changes (view switch or navigation)
- **reportError**: The function exported from `frontend/src/utils/errorReporter.ts` that forwards errors to Sentry in production and logs them in development
- **PostgREST**: The Supabase auto-generated REST API layer; accessed exclusively via `supabase.from('scheduled_posts')`
- **PostModal**: The `PostModal` React component defined inside `Calendar.tsx` that displays post details in an overlay

---

## Requirements

### Requirement 1 — Team-scoped post loading

**User Story:** As a team member, I want the calendar to show only my team's scheduled posts, so that I do not see posts belonging to other teams.

#### Acceptance Criteria

1. WHEN the Calendar mounts, THE Calendar SHALL read `user.id` from `AppContext` and pass the corresponding `teamId` to `CalendarService.getScheduledPosts()` so that the PostgREST query includes `eq('team_id', teamId)`.
2. WHILE `user` is `null` in `AppContext`, THE Calendar SHALL skip the `getScheduledPosts()` call and render the loading state until a non-null `user` is available.
3. WHEN `teamId` changes (e.g. the user switches teams), THE Calendar SHALL re-invoke `getScheduledPosts()` with the new `teamId` and replace the displayed events.
4. THE CalendarService `getScheduledPosts` function SHALL accept an optional `teamId` parameter and, when provided, append `.eq('team_id', teamId)` to the PostgREST query before execution.

---

### Requirement 2 — Date-range–scoped post loading

**User Story:** As a user, I want the calendar to fetch only posts within the currently visible date range, so that the query is efficient and does not load the entire post history.

#### Acceptance Criteria

1. WHEN FullCalendar fires the `datesSet` callback, THE Calendar SHALL extract `startStr` and `endStr` from the callback argument and pass them as `startDate` and `endDate` to `CalendarService.getScheduledPosts()`.
2. THE Calendar SHALL register the `datesSet` handler as a `useCallback`-memoised function so that the FullCalendar component does not receive a new function reference on every parent render.
3. THE CalendarService `getScheduledPosts` function SHALL, when `startDate` is provided, append `.gte('scheduled_at', startDate)` to the query, and when `endDate` is provided, append `.lte('scheduled_at', endDate)` to the query.
4. WHEN the user navigates to a different month, week, or day, THE Calendar SHALL invoke `getScheduledPosts()` with the updated date range and replace the event list with the newly returned posts.
5. IF `datesSet` fires before the previous fetch has resolved, THE Calendar SHALL allow the in-flight request to complete and update state with the most recently returned result.

---

### Requirement 3 — Error reporting on reschedule failure

**User Story:** As a developer, I want reschedule errors to be forwarded to the error-reporting system, so that failures are captured in Sentry and not silently swallowed.

#### Acceptance Criteria

1. WHEN `CalendarService.reschedulePost()` returns `null` (indicating a PostgREST or network error), THE Calendar SHALL call `reportError('Calendar.handleEventDrop', error, { postId })` in addition to displaying the `toast.error` notification.
2. THE Calendar SHALL import `reportError` from `../utils/errorReporter` and use it exclusively — no `console.error` calls SHALL remain in the reschedule error path.
3. WHEN `reschedulePost` fails, THE Calendar SHALL call `info.revert()` to restore the event to its original position before invoking `reportError` and `toast.error`.
4. THE `handleEventDrop` callback SHALL pass a structured context object `{ postId: post.id, attemptedDate: newDate.toISOString() }` as the third argument to `reportError`.

---

### Requirement 4 — Memoised datesSet handler

**User Story:** As a developer, I want the `datesSet` handler to be stable across renders, so that FullCalendar does not unnecessarily re-mount or re-subscribe when unrelated state changes occur.

#### Acceptance Criteria

1. THE Calendar SHALL declare the `datesSet` handler using `useCallback` with a dependency array that includes only the values the handler closes over (e.g. `teamId`).
2. WHILE the Calendar is mounted and no dependency changes, THE `datesSet` handler reference SHALL remain referentially stable across re-renders caused by unrelated state updates (e.g. `selectedPost` changes).
3. THE `useCallback`-wrapped `datesSet` handler SHALL be passed directly to the FullCalendar `datesSet` prop.

---

### Requirement 5 — TypeScript strict-mode compliance

**User Story:** As a developer, I want `Calendar.tsx` and `calendarService.ts` to pass `npx tsc --noEmit` with strict mode enabled, so that type errors do not reach production.

#### Acceptance Criteria

1. THE Calendar component and CalendarService SHALL produce zero TypeScript errors when `npx tsc --noEmit` is executed with `"strict": true` in `tsconfig.json`.
2. THE Calendar SHALL use `catch (error: unknown)` in all `try/catch` blocks — no `catch (error: any)` SHALL appear in `Calendar.tsx` or `calendarService.ts`.
3. WHEN accessing `info.event.extendedProps.post` in `handleEventClick` and `handleEventDrop`, THE Calendar SHALL cast the value to `ScheduledPost` using an explicit `as ScheduledPost` assertion rather than leaving it typed as `unknown`.
4. THE CalendarService SHALL type all function return values explicitly (e.g. `Promise<ScheduledPost[]>`, `Promise<ScheduledPost | null>`) with no implicit `any` return types.
5. IF `user` from `AppContext` is `null`, THE Calendar SHALL handle the null case explicitly so that no optional-chaining or non-null assertion is required to satisfy the TypeScript compiler.

---

### Requirement 6 — Post data display

**User Story:** As a user, I want to see all my scheduled posts on the calendar with clear visual indicators for platform and status, so that I can understand my content schedule at a glance.

#### Acceptance Criteria

1. THE Calendar SHALL render each `ScheduledPost` as a FullCalendar event with a background colour equal to the platform colour defined in `PLATFORM_CONFIG` for that post's `platform` field.
2. WHEN a post has `status === 'failed'`, THE Calendar SHALL override the event background colour with `#ef4444` (red) regardless of platform.
3. THE Calendar SHALL display posts with all four `PostStatus` values (`draft`, `scheduled`, `published`, `failed`) as visible events on the calendar grid.
4. THE Calendar SHALL render a platform legend below the header listing each `SocialPlatform` with its corresponding colour swatch and label, plus a red swatch labelled "Failed".
5. WHEN the Calendar has loaded and `posts.length === 0` with no error, THE Calendar SHALL display an empty-state panel with a `CalendarIcon` and the message "No posts scheduled".

---

### Requirement 7 — Post detail modal

**User Story:** As a user, I want to click a calendar event to see the full post details, so that I can review content, platform, scheduled time, status, and any error messages without leaving the calendar.

#### Acceptance Criteria

1. WHEN a user clicks a calendar event, THE Calendar SHALL set `selectedPost` to the corresponding `ScheduledPost` and render the `PostModal` component.
2. THE PostModal SHALL display the post's `platform` label and icon, `scheduled_at` formatted as a human-readable local date and time, `status` as a colour-coded badge, and `content` in a scrollable text area.
3. WHERE `post.media_urls` contains one or more URLs, THE PostModal SHALL render a link for each URL labelled "Media N" (where N is the 1-based index).
4. WHEN `post.status === 'failed'` and `post.error_message` is non-empty, THE PostModal SHALL display the error message inside a red-tinted alert panel with an `AlertCircleIcon`.
5. WHEN the user clicks the backdrop or the close button, THE Calendar SHALL set `selectedPost` to `null` and unmount the `PostModal`.

---

### Requirement 8 — Drag-and-drop rescheduling

**User Story:** As a user, I want to drag a calendar event to a new date or time and have the change persisted immediately, so that I can reschedule posts without opening a separate form.

#### Acceptance Criteria

1. WHEN a user drops a calendar event on a new date or time slot, THE Calendar SHALL call `CalendarService.reschedulePost(post.id, newDate.toISOString())` to persist the change via PostgREST PATCH.
2. WHEN `reschedulePost` returns a non-null `ScheduledPost`, THE Calendar SHALL update the local `posts` state to reflect the new `scheduled_at` value and display a `toast.success('Post rescheduled')` notification.
3. IF `reschedulePost` returns `null`, THE Calendar SHALL call `info.revert()` to restore the event, display a `toast.error('Failed to reschedule post')` notification, and call `reportError` as specified in Requirement 3.
4. IF `info.event.start` is `null` after a drop, THE Calendar SHALL call `info.revert()` immediately without invoking `reschedulePost`.
5. THE FullCalendar component SHALL have `editable={true}` and `droppable={true}` props set to enable drag-and-drop interaction.

---

### Requirement 9 — Calendar view support

**User Story:** As a user, I want to switch between month, week, and day views, so that I can inspect my schedule at different levels of granularity.

#### Acceptance Criteria

1. THE Calendar SHALL render FullCalendar with `dayGridPlugin`, `timeGridPlugin`, and `interactionPlugin` loaded so that month, week, and day views are all available.
2. THE Calendar SHALL configure the FullCalendar `headerToolbar` with `dayGridMonth`, `timeGridWeek`, and `timeGridDay` view buttons in the right section.
3. WHEN the user switches between month, week, and day views, THE Calendar SHALL trigger the `datesSet` callback and reload posts for the new visible date range as specified in Requirement 2.
4. THE Calendar SHALL set `initialView="dayGridMonth"` so that the month view is displayed on first render.

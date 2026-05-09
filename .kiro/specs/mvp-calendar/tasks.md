# Tasks: MVP Calendar

- [x] 1. Create calendar service
  - [x] 1.1 Create `frontend/src/services/calendarService.ts`
  - [x] 1.2 Implement `getScheduledPosts` querying scheduled_posts table
  - [x] 1.3 Implement `reschedulePost` updating scheduled_at via PATCH
  - [x] 1.4 Implement `getPostDetail` fetching a single post

- [x] 2. Build Calendar page
  - [x] 2.1 Replace `frontend/src/pages/Calendar.tsx` with FullCalendar implementation
  - [x] 2.2 Wire events to real scheduled_posts data
  - [x] 2.3 Add platform color coding for events
  - [x] 2.4 Add drag-and-drop rescheduling
  - [x] 2.5 Add post detail modal on event click
  - [x] 2.6 Add month/week/day view switcher
  - [x] 2.7 Add failed post indicator (red)
  - [x] 2.8 Add loading and empty states

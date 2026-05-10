# Implementation Plan: MVP Content Generation

## Overview

The core generation pipeline (job insertion → Edge Function invocation → Realtime subscription → Storage upload → credit reservation) is already implemented. This plan preserves all completed tasks and adds six targeted gap fixes across the database schema, Edge Function, frontend service, and UI components needed to reach a shippable MVP state.

## Tasks

- [x] 1. Create Supabase Edge Function for content generation
  - [x] 1.1 Create `supabase/functions/generate-content/index.ts`
    - _Requirements: 6.2 (Generation Flow)_
  - [x] 1.2 Handle text generation via OpenAI GPT-4
    - _Requirements: 6.2_
  - [x] 1.3 Handle image generation via DALL-E 3
    - _Requirements: 6.2_
  - [x] 1.4 Handle audio generation via ElevenLabs
    - _Requirements: 6.2_
  - [x] 1.5 Update content_jobs row on completion/failure
    - _Requirements: 6.2_
  - [x] 1.6 Upload result to Supabase Storage and save to media_items
    - _Requirements: 6.2_

- [x] 2. Create content service
  - [x] 2.1 Create `frontend/src/services/contentService.ts`
    - _Requirements: 6.2_
  - [x] 2.2 Implement `createContentJob` — inserts job row and invokes Edge Function
    - _Requirements: 6.2_
  - [x] 2.3 Implement `getPricingConfig` — fetches credit costs from pricing_config
    - _Requirements: 6.7_
  - [x] 2.4 Implement `cancelJob` — updates job status to failed, releases credits
    - _Requirements: 6.2_
  - [x] 2.5 Implement `subscribeToJob` — Realtime subscription to job row changes
    - _Requirements: 6.2_

- [x] 3. Build ContentHub page
  - [x] 3.1 Replace `frontend/src/pages/content/ContentHub.tsx` with full implementation
    - _Requirements: 6.2_
  - [x] 3.2 Add content type selector (Text, Image, Video, Audio) with credit cost display
    - _Requirements: 6.2, 6.7_
  - [x] 3.3 Add prompt input with brand voice toggle
    - _Requirements: 6.2_
  - [x] 3.4 Add tone selector (Professional, Casual, Humorous, Inspirational)
    - _Requirements: 6.2_
  - [x] 3.5 Add generation progress indicator using Realtime subscription
    - _Requirements: 6.2_
  - [x] 3.6 Add result display with copy/download/save-to-library actions
    - _Requirements: 6.2_
  - [x] 3.7 Add error handling with toast notifications
    - _Requirements: 6.2_
  - [x] 3.8 Add credit cost estimation before submission
    - _Requirements: 6.7_

- [x] 4. Add `cancelled` to job_status enum and TypeScript type
  - [x] 4.1 Create migration `supabase/migrations/20260502000001_add_cancelled_status.sql` with `ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'cancelled'`
    - Makes the migration idempotent — safe to re-apply after rollback
    - _Requirements: 1.1, 1.3_
  - [x] 4.2 Add `'cancelled'` to the `JobStatus` union type in `frontend/src/types/index.ts`
    - Change: `export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'`
    - All downstream consumers (`StatusBadge`, `cancelJob`, `ContentHub`) will accept `'cancelled'` without type errors
    - _Requirements: 1.2, 1.4_
  - [ ]* 4.3 Write property test for cancelled status round-trip
    - **Property 1: Cancelled status round-trip**
    - Setting `status` to `'cancelled'` via UPDATE should persist without a constraint violation and a subsequent SELECT should return `status = 'cancelled'`
    - **Validates: Requirements 1.3**

- [ ] 5. Fix Edge Function: replace hardcoded brand_voice with brand_profiles DB query
  - [ ] 5.1 In `supabase/functions/generate-content/index.ts`, before building the system prompt, query `brand_profiles` using `job.user_id` via the existing service-role `supabase` client
    - Use `.maybeSingle()` so a missing row returns `null` without throwing
    - If the query errors, treat `voiceGuidelines` as `null` (non-fatal fallback)
    - _Requirements: 2.1, 2.3, 2.5_
  - [ ] 5.2 Replace the `job.metadata.brand_voice` reference in the system prompt with the retrieved `voice_guidelines` value; omit the brand voice clause entirely when `voice_guidelines` is null
    - _Requirements: 2.2, 2.4_
  - [ ]* 5.3 Write property test for brand voice injection
    - **Property 2: Brand voice injection**
    - For any non-null, non-empty `voice_guidelines`, the constructed system prompt should contain that string and should NOT contain any value from `job.metadata.brand_voice`
    - **Validates: Requirements 2.2, 2.4**

- [ ] 6. Fix Edge Function error handler: replace rpc('greatest') with Math.max credit release
  - [ ] 6.1 In the catch block of `supabase/functions/generate-content/index.ts`, fetch the live `wallets` row for `job.user_id` using the existing `supabase` client (not `supabase2`)
    - Use `.maybeSingle()` — if no wallet row is found, skip the credit release and proceed
    - _Requirements: 3.3, 3.4_
  - [ ] 6.2 Compute the new `reserved` value as `Math.max(0, wallet.reserved - job.credits_reserved)` and write it back via a single `UPDATE` on `wallets.id`
    - Remove the `supabase2.rpc('greatest', ...)` call and the redundant `supabase2` client instance
    - _Requirements: 3.1, 3.2, 3.5_
  - [ ]* 6.3 Write property test for credit release arithmetic
    - **Property 3: Credit release arithmetic**
    - For any non-negative `wallet.reserved` and non-negative `job.credits_reserved`, the released value should equal `Math.max(0, wallet.reserved - job.credits_reserved)` — never negative, never greater than the original `wallet.reserved`
    - **Validates: Requirements 3.1, 4.4**

- [ ] 7. Fix `cancelJob` in contentService.ts: set status to `cancelled` and guard terminal statuses
  - [ ] 7.1 At the start of `cancelJob` in `frontend/src/services/contentService.ts`, fetch the current job row and return early if `status` is already `'cancelled'`, `'completed'`, or `'failed'`
    - _Requirements: 4.3_
  - [ ] 7.2 Change the status update from `'failed'` to `'cancelled'` and add `error_message: 'Cancelled by user'` to the same update call
    - _Requirements: 4.1, 4.2_
  - [ ] 7.3 After updating the job status, fetch the wallet row and release reserved credits using `Math.max(0, wallet.reserved - job.credits_reserved)`
    - Use `.maybeSingle()` — skip the wallet update if no row is found
    - _Requirements: 4.4_
  - [ ]* 7.4 Write property test for cancelJob idempotence on terminal statuses
    - **Property 4: cancelJob idempotence on terminal statuses**
    - For any job with status `'cancelled'`, `'completed'`, or `'failed'`, calling `cancelJob` should leave the row unchanged — no status update, no credit release, no error
    - **Validates: Requirements 4.3**
  - [ ]* 7.5 Write property test for cancelJob correct status and message
    - **Property 5: cancelJob sets correct status and message**
    - For any job with status `'pending'` or `'running'`, calling `cancelJob` should result in `status = 'cancelled'` and `error_message = 'Cancelled by user'`
    - **Validates: Requirements 4.1, 4.2**

- [ ] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Add `cancelled` style to `StatusBadge` component
  - [ ] 9.1 In `frontend/src/pages/content/ContentHub.tsx`, extend the `styles` record in `StatusBadge` from `Record<string, string>` to `Record<JobStatus, string>` and add the `cancelled` entry with grey/slate styling: `'bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400'`
    - _Requirements: 5.1, 5.2_
  - [ ] 9.2 Add `cancelled: 'Cancelled'` to the `labels` record in `StatusBadge` so the badge displays a human-readable label
    - _Requirements: 5.3, 5.4_
  - [ ]* 9.3 Write property test for StatusBadge exhaustive style mapping
    - **Property 6: StatusBadge exhaustive style mapping**
    - For any valid `JobStatus` value (including `'cancelled'`), `StatusBadge` should render a badge with a non-empty CSS class string and a non-empty label, and no two distinct status values should produce the same CSS class string
    - **Validates: Requirements 5.2, 5.3**

- [ ] 10. Make `ResultViewer` fetch and render text/video content inline
  - [ ] 10.1 In `frontend/src/pages/content/ContentHub.tsx`, add `textContent`, `fetchError`, and `isFetching` state to `ResultViewer`; add a `useEffect` that fires when `job.type` is `'text'` or `'video'`, `job.result_url` is non-null, and `job.status` is `'completed'` — fetch the URL with the browser `fetch` API and store the response body as text
    - _Requirements: 6.1, 6.2_
  - [ ] 10.2 Render a loading spinner while `isFetching` is true; render the fetched text inline in a `<pre>` or `<p>` element when fetch succeeds; render an error message with a fallback `<a href={result_url}>` link when fetch fails or returns a non-OK status
    - _Requirements: 6.2, 6.3, 6.6_
  - [ ] 10.3 Ensure `image` jobs render an `<img src={result_url}>` and `audio` jobs render an `<audio src={result_url} controls>` — these types must NOT trigger the text fetch path
    - _Requirements: 6.4, 6.5_
  - [ ] 10.4 Update `handleCopy` to copy from the already-fetched `textContent` state rather than re-fetching
    - _Requirements: 6.1_
  - [ ]* 10.5 Write property test for ResultViewer inline text rendering
    - **Property 7: ResultViewer inline text rendering**
    - For any completed `text` or `video` job with a non-null `result_url` returning a successful HTTP response, `ResultViewer` should render the response body as visible text in the DOM — not as a raw anchor href
    - **Validates: Requirements 6.1, 6.6**
  - [ ]* 10.6 Write property test for ResultViewer fetch error fallback
    - **Property 8: ResultViewer fetch error fallback**
    - For any completed `text` or `video` job where the fetch returns a non-OK status or throws a network error, `ResultViewer` should render an error message and an anchor element whose `href` equals `result_url`
    - **Validates: Requirements 6.3**
  - [ ]* 10.7 Write property test for ResultViewer media element routing
    - **Property 9: ResultViewer media element routing**
    - For any completed `image` job, `ResultViewer` renders an `<img>` with `src = result_url`; for any completed `audio` job, it renders an `<audio>` with `src = result_url`
    - **Validates: Requirements 6.4, 6.5**

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks 1–3 (and all sub-tasks) are already complete — marked `[x]`
- Tasks 4–10 are the six targeted gap fixes required for MVP shippability
- Sub-tasks marked with `*` are optional property-based tests and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 8 and 11) ensure incremental validation between the database/Edge Function layer and the UI layer
- Property tests validate universal correctness properties defined in `design.md`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["4.1", "4.2"] },
    { "id": 1, "tasks": ["4.3", "5.1", "6.1", "7.1"] },
    { "id": 2, "tasks": ["5.2", "6.2", "7.2", "7.3"] },
    { "id": 3, "tasks": ["5.3", "6.3", "7.4", "7.5", "9.1"] },
    { "id": 4, "tasks": ["9.2", "10.1"] },
    { "id": 5, "tasks": ["9.3", "10.2", "10.3", "10.4"] },
    { "id": 6, "tasks": ["10.5", "10.6", "10.7"] }
  ]
}
```

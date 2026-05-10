# Requirements Document

## Introduction

This document covers the remaining gaps needed to bring the MVP content generation feature to a shippable state. The core generation flow — job insertion, Edge Function invocation, Realtime subscription, Storage upload, and credit reservation — is already implemented. The outstanding work is a set of targeted fixes and additions across the database schema, Edge Function, frontend service, and UI components. Specifically: adding `cancelled` to the `job_status` enum, fixing the credit-release bug in the Edge Function error handler, replacing the hardcoded `brand_voice` metadata lookup with a `brand_profiles` DB query, correcting `cancelJob` to set status `cancelled` instead of `failed`, adding a `cancelled` style to `StatusBadge`, and making `ResultViewer` fetch and render text/video content inline from Storage.

## Glossary

- **ContentJob**: An asynchronous AI generation task tracked in the `content_jobs` table with a `job_status` value.
- **EdgeFunction**: The Deno serverless function `generate-content` deployed on Supabase that calls AI providers and updates job rows.
- **BrandProfile**: A row in the `brand_profiles` table containing `voice_guidelines` and `tone_settings` for a user, injected into AI system prompts.
- **Wallet**: A row in the `wallets` table holding a user's `balance` and `reserved` credit counts.
- **ReservedCredits**: Credits held against a user's wallet balance when a job is created; released on failure or cancellation, deducted on success.
- **StatusBadge**: The frontend UI component that renders a colored badge for a `JobStatus` value.
- **ResultViewer**: The frontend UI component that renders the generated output for a completed job.
- **job_status enum**: The PostgreSQL enum type `public.job_status` used by the `content_jobs` table.
- **JobStatus type**: The TypeScript union type `JobStatus` in `frontend/src/types/index.ts` mirroring the DB enum.
- **Realtime**: Supabase Realtime — the WebSocket-based subscription mechanism used to push `content_jobs` row changes to the frontend without polling.

---

## Requirements

### Requirement 1 — Add `cancelled` to the job_status enum and TypeScript type

**User Story:** As a developer, I want the `cancelled` status to exist in both the database enum and the TypeScript type, so that all layers of the system can represent a cancelled job without type errors or constraint violations.

#### Acceptance Criteria

1. THE Database SHALL define a migration that adds `'cancelled'` to the `public.job_status` PostgreSQL enum using `ALTER TYPE public.job_status ADD VALUE 'cancelled'`.
2. THE `JobStatus` TypeScript type in `frontend/src/types/index.ts` SHALL include `'cancelled'` as a valid union member alongside `'pending'`, `'running'`, `'completed'`, and `'failed'`.
3. WHEN the migration is applied, THE Database SHALL allow `content_jobs.status` to be set to `'cancelled'` without a constraint violation.
4. IF the `JobStatus` type does not include `'cancelled'`, THEN THE TypeScript compiler SHALL emit a type error when any code assigns `'cancelled'` to a `JobStatus` variable.

---

### Requirement 2 — Edge Function: fetch brand voice from `brand_profiles` table

**User Story:** As a content creator, I want my brand voice guidelines to be applied to AI-generated content based on my saved brand profile, so that generated content consistently reflects my brand identity without requiring me to pass sensitive guidelines through the frontend.

#### Acceptance Criteria

1. WHEN the EdgeFunction processes a job of type `text` or `video`, THE EdgeFunction SHALL query the `brand_profiles` table using `job.user_id` to retrieve the user's `voice_guidelines`.
2. WHEN a matching `brand_profiles` row exists and `voice_guidelines` is non-null, THE EdgeFunction SHALL use the retrieved `voice_guidelines` value in the OpenAI system prompt instead of `job.metadata.brand_voice`.
3. WHEN no matching `brand_profiles` row exists or `voice_guidelines` is null, THE EdgeFunction SHALL construct the OpenAI system prompt without a brand voice clause.
4. THE EdgeFunction SHALL NOT read `job.metadata.brand_voice` when building the AI system prompt for any content type.
5. THE EdgeFunction SHALL use the existing `supabase` service-role client instance to query `brand_profiles`, with no additional client instantiation required for this lookup.

---

### Requirement 3 — Edge Function error handler: fix credit release using `Math.max`

**User Story:** As a user, I want my reserved credits to be correctly released when a generation job fails, so that I am not permanently charged for content that was never produced.

#### Acceptance Criteria

1. WHEN a generation error occurs and the EdgeFunction enters the catch block, THE EdgeFunction SHALL release the user's reserved credits by computing the new `reserved` value as `Math.max(0, wallet.reserved - job.credits_reserved)`.
2. THE EdgeFunction SHALL NOT call `supabase2.rpc('greatest', ...)` or any Supabase RPC method to compute the released credit value.
3. WHEN releasing reserved credits, THE EdgeFunction SHALL first fetch the current `wallets` row for `job.user_id` to obtain the live `reserved` balance before computing the updated value.
4. WHEN the wallet fetch returns no row, THE EdgeFunction SHALL skip the credit release update and proceed with marking the job as `failed`.
5. IF the computed `Math.max(0, wallet.reserved - job.credits_reserved)` result is zero or positive, THEN THE EdgeFunction SHALL write that value to `wallets.reserved` via a single `UPDATE` statement.

---

### Requirement 4 — Frontend `cancelJob`: set status to `cancelled`

**User Story:** As a user, I want cancelling a job to mark it as `cancelled` rather than `failed`, so that I can distinguish between jobs I intentionally stopped and jobs that errored unexpectedly.

#### Acceptance Criteria

1. WHEN `cancelJob` is called in `contentService.ts`, THE ContentService SHALL update the `content_jobs` row to `status: 'cancelled'` instead of `status: 'failed'`.
2. WHEN `cancelJob` sets status to `'cancelled'`, THE ContentService SHALL also set `error_message` to `'Cancelled by user'` on the same row update.
3. WHEN `cancelJob` is called on a job whose current status is `'cancelled'`, `'completed'`, or `'failed'`, THE ContentService SHALL return without making any database updates.
4. AFTER setting the job status to `'cancelled'`, THE ContentService SHALL release the job's reserved credits by updating `wallets.reserved` to `Math.max(0, wallet.reserved - job.credits_reserved)` for the matching user wallet.

---

### Requirement 5 — Frontend `StatusBadge`: render `cancelled` status

**User Story:** As a user, I want to see a visually distinct badge when a job has been cancelled, so that I can quickly identify cancelled jobs in the job history list.

#### Acceptance Criteria

1. THE StatusBadge component SHALL render a badge for the `'cancelled'` status value without throwing a runtime error or falling through to an unhandled default.
2. WHEN the `status` prop is `'cancelled'`, THE StatusBadge SHALL apply a visual style that is distinct from the styles used for `'pending'`, `'running'`, `'completed'`, and `'failed'`.
3. WHEN the `status` prop is `'cancelled'`, THE StatusBadge SHALL display a human-readable label (e.g., `"Cancelled"`) within the badge element.
4. THE StatusBadge component SHALL remain type-safe such that passing `'cancelled'` as the `status` prop does not produce a TypeScript compiler error after the `JobStatus` type is updated.

---

### Requirement 6 — Frontend `ResultViewer`: fetch and render text and video content inline

**User Story:** As a user, I want to read generated text and video scripts directly in the result panel without navigating to a separate URL, so that I can review and copy the output without leaving the page.

#### Acceptance Criteria

1. WHEN a completed job has `type === 'text'` or `type === 'video'` and a non-null `result_url`, THE ResultViewer SHALL fetch the content from `result_url` using the browser `fetch` API and render the response body as plain text inline in the component.
2. WHILE the ResultViewer is fetching content from `result_url`, THE ResultViewer SHALL display a loading indicator to the user.
3. IF the fetch request to `result_url` fails or returns a non-OK HTTP status, THEN THE ResultViewer SHALL display an error message and provide the `result_url` as a fallback link.
4. WHEN a completed job has `type === 'image'`, THE ResultViewer SHALL render the asset as an `<img>` element using `result_url` as the `src`, without fetching the URL as text.
5. WHEN a completed job has `type === 'audio'`, THE ResultViewer SHALL render the asset using an `<audio>` element with `result_url` as the `src`, without fetching the URL as text.
6. THE ResultViewer SHALL NOT render a raw URL string as the primary display for `text` or `video` job types when `result_url` is available.

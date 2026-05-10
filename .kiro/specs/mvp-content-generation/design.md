# Design Document — MVP Content Generation

## Overview

This document describes the targeted fixes and additions required to bring the MVP content generation feature to a shippable state. The core generation pipeline (job insertion → Edge Function invocation → Realtime subscription → Storage upload → credit reservation) is already implemented. The remaining work is six discrete, well-scoped changes across four layers: database schema, Edge Function, frontend service, and UI components.

The changes are:
1. Add `cancelled` to the `job_status` PostgreSQL enum and the `JobStatus` TypeScript type
2. Replace the hardcoded `brand_voice` metadata lookup in the Edge Function with a `brand_profiles` DB query
3. Fix the credit-release bug in the Edge Function error handler (replace broken `rpc('greatest')` call with `Math.max`)
4. Fix `cancelJob` in `contentService.ts` to set status `'cancelled'` instead of `'failed'`
5. Add a `cancelled` style to the `StatusBadge` component
6. Make `ResultViewer` fetch and render text/video content inline from Storage

---

## Architecture

The feature spans four layers. Each change is isolated to a single layer with no cross-cutting concerns.

```
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Supabase)                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  job_status enum  ← ADD 'cancelled'                      │  │
│  │  content_jobs table  (status: job_status)                │  │
│  │  brand_profiles table  (voice_guidelines: text)          │  │
│  │  wallets table  (reserved: int)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         ▲ service-role client                ▲ anon client
         │                                    │
┌────────┴──────────────────┐   ┌─────────────┴──────────────────┐
│  Edge Function            │   │  Frontend (React + TypeScript)  │
│  generate-content/        │   │                                 │
│  index.ts                 │   │  types/index.ts                 │
│                           │   │    JobStatus ← ADD 'cancelled'  │
│  ① brand_profiles query   │   │                                 │
│  ② Math.max credit fix    │   │  services/contentService.ts     │
│                           │   │    cancelJob ← fix status       │
│                           │   │    cancelJob ← Math.max credits │
│                           │   │                                 │
│                           │   │  pages/content/ContentHub.tsx   │
│                           │   │    StatusBadge ← 'cancelled'    │
│                           │   │    ResultViewer ← inline fetch  │
└───────────────────────────┘   └─────────────────────────────────┘
```

---

## Components and Interfaces

### 1. Database Migration — `job_status` enum

**File:** `supabase/migrations/20260502000001_add_cancelled_status.sql`

A single `ALTER TYPE` statement adds `'cancelled'` to the existing `public.job_status` enum. PostgreSQL requires `ADD VALUE` for enum extension; this is a non-destructive, forward-only migration.

```sql
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'cancelled';
```

The `IF NOT EXISTS` guard makes the migration idempotent — safe to run against a database that already has the value (e.g., after a rollback and re-apply).

---

### 2. TypeScript Type — `JobStatus`

**File:** `frontend/src/types/index.ts`

The `JobStatus` union type is extended to include `'cancelled'`. All downstream consumers (`StatusBadge`, `cancelJob`, `ContentHub`) will then accept `'cancelled'` without type errors.

```typescript
// Before
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

// After
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
```

The `ContentJob` interface already uses `JobStatus` for its `status` field, so no further type changes are needed.

---

### 3. Edge Function — Brand Profile Lookup

**File:** `supabase/functions/generate-content/index.ts`

**Current behaviour:** The system prompt is built from `job.metadata.brand_voice`, which is a value passed through the frontend and stored in the job row. This bypasses the `brand_profiles` table entirely.

**Target behaviour:** Before building the system prompt, the Edge Function queries `brand_profiles` for the job's `user_id` and uses `voice_guidelines` if present.

```typescript
// Query brand profile using the existing service-role client
const { data: brandProfile } = await supabase
  .from('brand_profiles')
  .select('voice_guidelines')
  .eq('user_id', job.user_id)
  .maybeSingle()

const voiceGuidelines = brandProfile?.voice_guidelines ?? null

const systemPrompt = voiceGuidelines
  ? `You are a content creator. Brand voice: ${voiceGuidelines}. Tone: ${job.metadata?.tone ?? 'professional'}.`
  : `You are a professional content creator. Tone: ${job.metadata?.tone ?? 'professional'}.`
```

The existing `supabase` client (service-role) is reused — no new client instantiation. The `job.metadata.brand_voice` field is no longer read.

---

### 4. Edge Function — Credit Release Fix

**File:** `supabase/functions/generate-content/index.ts`

**Current behaviour (buggy):** The catch block calls `supabase2.rpc('greatest', { a: 0, b: 0 })` which always sets `reserved` to `0` regardless of the actual wallet state, and uses a second `supabase2` client instance unnecessarily.

**Target behaviour:** Fetch the live wallet row, compute the new `reserved` value with `Math.max`, and write it back in a single `UPDATE`.

```typescript
// In the catch block, after marking the job as failed:
if (job) {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, reserved')
    .eq('user_id', job.user_id)
    .is('team_id', null)
    .maybeSingle()

  if (wallet) {
    await supabase
      .from('wallets')
      .update({ reserved: Math.max(0, wallet.reserved - job.credits_reserved) })
      .eq('id', wallet.id)
  }
  // If wallet is null, skip the update — no credits to release
}
```

The redundant `supabase2` client is removed; the existing `supabase` client is used throughout the catch block.

---

### 5. Frontend Service — `cancelJob` Fix

**File:** `frontend/src/services/contentService.ts`

**Current behaviour (buggy):** `cancelJob` sets `status: 'failed'` and does not guard against calling on already-terminal jobs with status `'cancelled'`.

**Target behaviour:**
- Guard: return early if current status is `'cancelled'`, `'completed'`, or `'failed'`
- Set `status: 'cancelled'` and `error_message: 'Cancelled by user'`
- Release reserved credits with `Math.max(0, wallet.reserved - job.credits_reserved)`

```typescript
export async function cancelJob(jobId: string, userId: string): Promise<void> {
  try {
    const { data: job } = await supabase
      .from('content_jobs')
      .select('credits_reserved, status')
      .eq('id', jobId)
      .single()

    if (
      !job ||
      job.status === 'cancelled' ||
      job.status === 'completed' ||
      job.status === 'failed'
    ) {
      return
    }

    await supabase
      .from('content_jobs')
      .update({ status: 'cancelled', error_message: 'Cancelled by user' })
      .eq('id', jobId)

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, reserved')
      .eq('user_id', userId)
      .is('team_id', null)
      .maybeSingle()

    if (wallet) {
      await supabase
        .from('wallets')
        .update({ reserved: Math.max(0, wallet.reserved - job.credits_reserved) })
        .eq('id', wallet.id)
    }
  } catch (error: unknown) {
    reportError('contentService.cancelJob', error, { jobId })
  }
}
```

---

### 6. UI Component — `StatusBadge`

**File:** `frontend/src/pages/content/ContentHub.tsx`

The `styles` record in `StatusBadge` is extended with a `cancelled` entry. The chosen colour is grey/slate — visually distinct from yellow (pending), blue (running), green (completed), and red (failed).

```typescript
const StatusBadge: React.FC<{ status: JobStatus }> = ({ status }) => {
  const styles: Record<JobStatus, string> = {
    pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    running:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400',
  }
  const labels: Record<JobStatus, string> = {
    pending:   'Pending',
    running:   'Running',
    completed: 'Completed',
    failed:    'Failed',
    cancelled: 'Cancelled',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
```

Changing the `styles` value from `Record<string, string>` to `Record<JobStatus, string>` makes the mapping exhaustive — the TypeScript compiler will error if a new `JobStatus` value is added without a corresponding style entry.

---

### 7. UI Component — `ResultViewer`

**File:** `frontend/src/pages/content/ContentHub.tsx`

**Current behaviour:** For `text` and `video` jobs, `ResultViewer` renders a raw anchor link to `result_url` rather than fetching and displaying the content inline.

**Target behaviour:** Fetch the text content from `result_url` using the browser `fetch` API and render it inline. Show a loading spinner while fetching. Show an error message with a fallback link if the fetch fails.

```typescript
const ResultViewer: React.FC<{ job: ContentJob }> = ({ job }) => {
  const [copied, setCopied] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    if (
      (job.type === 'text' || job.type === 'video') &&
      job.result_url &&
      job.status === 'completed'
    ) {
      setIsFetching(true)
      setFetchError(null)
      fetch(job.result_url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.text()
        })
        .then((text) => {
          setTextContent(text)
        })
        .catch((err: unknown) => {
          setFetchError(err instanceof Error ? err.message : 'Failed to load content')
        })
        .finally(() => {
          setIsFetching(false)
        })
    }
  }, [job.id, job.result_url, job.type, job.status])

  // ... render branches (see below)
}
```

**Render branches:**

| Job type | `result_url` | Render |
|---|---|---|
| `image` | present | `<img src={result_url} />` + download link |
| `audio` | present | `<audio src={result_url} controls />` + download link |
| `text` / `video` | present, fetching | Loading spinner |
| `text` / `video` | present, fetch OK | Inline `<pre>` / `<p>` with text content + copy + download |
| `text` / `video` | present, fetch error | Error message + fallback `<a href={result_url}>` |
| any | null | "Content generated successfully." fallback |

The `handleCopy` function is updated to copy from the already-fetched `textContent` state rather than re-fetching.

---

## Data Models

No new tables or columns are introduced. The changes touch existing structures:

| Layer | Object | Change |
|---|---|---|
| PostgreSQL | `public.job_status` enum | Add value `'cancelled'` |
| TypeScript | `JobStatus` union type | Add `'cancelled'` member |
| Edge Function | `generate-content` | Read `brand_profiles.voice_guidelines`; fix `wallets.reserved` update |
| Frontend service | `cancelJob` | Set `status: 'cancelled'`; guard terminal statuses; fix credit math |
| Frontend UI | `StatusBadge` | Add `cancelled` style and label |
| Frontend UI | `ResultViewer` | Fetch and render text/video inline |

---

## Error Handling

### Edge Function — brand profile query failure
If the `brand_profiles` query itself errors (network issue, RLS denial), the Edge Function should not abort generation. The query uses `.maybeSingle()` which returns `null` data on no-match. A query error is handled by checking the error return and falling back to the no-brand-voice prompt path.

```typescript
const { data: brandProfile, error: bpError } = await supabase
  .from('brand_profiles')
  .select('voice_guidelines')
  .eq('user_id', job.user_id)
  .maybeSingle()

// bpError is non-fatal — fall back to no brand voice
const voiceGuidelines = bpError ? null : (brandProfile?.voice_guidelines ?? null)
```

### Edge Function — wallet fetch failure in catch block
If the wallet fetch in the catch block returns no row, the credit release is skipped. The job is still marked `failed`. This is the correct behaviour — a missing wallet means there are no credits to release.

### `cancelJob` — concurrent cancellation
The guard check (`job.status === 'cancelled'`) prevents double-cancellation. However, there is a TOCTOU window between the status read and the update. This is acceptable for the MVP — the worst case is two concurrent cancel calls both writing `status: 'cancelled'`, which is idempotent.

### `ResultViewer` — fetch errors
Non-OK HTTP responses (e.g., 403 from expired Storage URL, 404 for missing file) are treated as errors and surface the fallback link. Network errors (offline, CORS) are caught by the `.catch()` handler and display the same error UI.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Cancelled status round-trip

*For any* valid `content_jobs` row, setting `status` to `'cancelled'` via a database UPDATE should persist without a constraint violation, and a subsequent SELECT on that row should return `status = 'cancelled'`.

**Validates: Requirements 1.3**

---

### Property 2: Brand voice injection

*For any* non-null, non-empty `voice_guidelines` string retrieved from `brand_profiles`, the system prompt constructed by the Edge Function should contain that string, and should NOT contain any value sourced from `job.metadata.brand_voice`.

**Validates: Requirements 2.2, 2.4**

---

### Property 3: Credit release arithmetic

*For any* non-negative integer `wallet.reserved` and non-negative integer `job.credits_reserved`, the released `reserved` value written to the `wallets` table should equal `Math.max(0, wallet.reserved - job.credits_reserved)` — never negative, never greater than the original `wallet.reserved`.

**Validates: Requirements 3.1, 4.4**

---

### Property 4: cancelJob idempotence on terminal statuses

*For any* `content_jobs` row whose current `status` is `'cancelled'`, `'completed'`, or `'failed'`, calling `cancelJob` should leave the row unchanged — no status update, no credit release, no error.

**Validates: Requirements 4.3**

---

### Property 5: cancelJob sets correct status and message

*For any* `content_jobs` row whose current `status` is `'pending'` or `'running'`, calling `cancelJob` should result in `status = 'cancelled'` and `error_message = 'Cancelled by user'` on that row.

**Validates: Requirements 4.1, 4.2**

---

### Property 6: StatusBadge exhaustive style mapping

*For any* valid `JobStatus` value (including `'cancelled'`), the `StatusBadge` component should render a badge with a non-empty CSS class string and a non-empty human-readable label, and no two distinct status values should produce the same CSS class string.

**Validates: Requirements 5.2, 5.3**

---

### Property 7: ResultViewer inline text rendering

*For any* completed `text` or `video` job with a non-null `result_url` that returns a successful HTTP response, the `ResultViewer` component should render the response body as visible text content in the DOM — not as a raw anchor href.

**Validates: Requirements 6.1, 6.6**

---

### Property 8: ResultViewer fetch error fallback

*For any* completed `text` or `video` job with a non-null `result_url` where the fetch returns a non-OK HTTP status or throws a network error, the `ResultViewer` should render an error message and an anchor element whose `href` equals `result_url`.

**Validates: Requirements 6.3**

---

### Property 9: ResultViewer media element routing

*For any* completed `image` job with a non-null `result_url`, the `ResultViewer` should render an `<img>` element with `src = result_url`. *For any* completed `audio` job with a non-null `result_url`, the `ResultViewer` should render an `<audio>` element with `src = result_url`.

**Validates: Requirements 6.4, 6.5**

# Design Document — mvp-workflow-dashboard

## Overview

This design covers the targeted changes needed to complete `WorkflowDashboard.tsx` and `workflowService.ts` for the Creozel MVP. The existing implementation already fetches live stats and recent executions from the `pipeline_executions` table via PostgREST. The remaining work is:

1. Add `pausePipeline`, `resumePipeline`, and `deletePipeline` to `workflowService.ts`
2. Render pause/resume/delete action buttons on each execution row in `WorkflowDashboard.tsx`
3. Surface `step_failed` alongside `error_message` for failed rows
4. Remove the unused `Link` import
5. Verify TypeScript strict mode compliance across both files

No new dependencies are introduced. All data access continues through the `supabase` client singleton.

---

## Architecture

The feature touches two files only:

```
frontend/src/
├── services/
│   └── workflowService.ts      ← add pausePipeline, resumePipeline, deletePipeline
└── pages/workflow/
    └── WorkflowDashboard.tsx   ← add action buttons, step_failed display, remove Link import
```

The `PipelineExecution` type in `frontend/src/types/index.ts` already includes `step_failed?: string`, so no type changes are needed.

---

## Components

### `workflowService.ts` — New Mutation Functions

Three new exported async functions follow the exact same pattern as the existing `getRecentExecutions`:

- `supabase` client from `../lib/supabase` as the sole HTTP mechanism
- `try/catch` with `catch (error: unknown)`
- `reportError` from `../utils/errorReporter` on failure
- Return `true` on success, `false` on error

#### `pausePipeline(id: string): Promise<boolean>`

Issues a PostgREST PATCH setting `status` to `'pending'` for the row matching `id`. Semantically, "pausing" a pipeline marks it as pending so n8n can skip or defer it.

```typescript
export async function pausePipeline(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pipeline_executions')
      .update({ status: 'pending' })
      .eq('id', id)
    if (error) {
      reportError('workflowService.pausePipeline', error)
      return false
    }
    return true
  } catch (error: unknown) {
    reportError('workflowService.pausePipeline', error)
    return false
  }
}
```

#### `resumePipeline(id: string): Promise<boolean>`

Issues a PostgREST PATCH setting `status` to `'running'` for the row matching `id`.

```typescript
export async function resumePipeline(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pipeline_executions')
      .update({ status: 'running' })
      .eq('id', id)
    if (error) {
      reportError('workflowService.resumePipeline', error)
      return false
    }
    return true
  } catch (error: unknown) {
    reportError('workflowService.resumePipeline', error)
    return false
  }
}
```

#### `deletePipeline(id: string): Promise<boolean>`

Issues a PostgREST DELETE for the row matching `id`.

```typescript
export async function deletePipeline(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pipeline_executions')
      .delete()
      .eq('id', id)
    if (error) {
      reportError('workflowService.deletePipeline', error)
      return false
    }
    return true
  } catch (error: unknown) {
    reportError('workflowService.deletePipeline', error)
    return false
  }
}
```

---

### `WorkflowDashboard.tsx` — Changes

#### 1. Remove unused `Link` import

The `Link` import from `react-router-dom` is not referenced anywhere in the component JSX. It must be removed to satisfy TypeScript strict mode (`noUnusedLocals`) and lint rules.

```typescript
// BEFORE
import { Link } from 'react-router-dom'

// AFTER — line deleted entirely
```

#### 2. In-flight action tracking state

A `Set<string>` tracks which execution IDs currently have an in-flight action. This drives the disabled state of action buttons without requiring per-row state objects.

```typescript
const [actionInFlight, setActionInFlight] = useState<Set<string>>(new Set())
const [actionError, setActionError] = useState<string | null>(null)
```

Helper to wrap any action:

```typescript
const runAction = async (id: string, fn: () => Promise<boolean>): Promise<void> => {
  setActionInFlight((prev) => new Set(prev).add(id))
  setActionError(null)
  const ok = await fn()
  setActionInFlight((prev) => {
    const next = new Set(prev)
    next.delete(id)
    return next
  })
  if (!ok) {
    setActionError('Action failed. Please try again.')
  } else {
    void load()
  }
}
```

#### 3. Action buttons per execution row

Buttons are rendered inside each execution row. The pause button is shown for `running` or `pending` status. The delete button is always shown. A resume button is shown for `pending` status (representing a previously paused pipeline — the UI cannot distinguish "never started pending" from "paused pending" without additional metadata, so resume is shown for all `pending` rows alongside pause; the user chooses the appropriate action).

```tsx
const isInFlight = actionInFlight.has(exec.id)

{(exec.status === 'running' || exec.status === 'pending') && (
  <button
    aria-label="Pause pipeline"
    disabled={isInFlight}
    onClick={() => void runAction(exec.id, () => pausePipeline(exec.id))}
    className="p-1.5 rounded-lg text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 disabled:opacity-40 transition-colors"
  >
    <PauseIcon size={14} />
  </button>
)}
{exec.status === 'pending' && (
  <button
    aria-label="Resume pipeline"
    disabled={isInFlight}
    onClick={() => void runAction(exec.id, () => resumePipeline(exec.id))}
    className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40 transition-colors"
  >
    <PlayIcon size={14} />
  </button>
)}
<button
  aria-label="Delete pipeline"
  disabled={isInFlight}
  onClick={() => void runAction(exec.id, () => deletePipeline(exec.id))}
  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
>
  <Trash2Icon size={14} />
</button>
```

`PauseIcon` and `Trash2Icon` are added to the existing `lucide-react` import. `PlayIcon` is already imported.

#### 4. Error notification banner

A dismissible inline error banner is rendered above the executions list when `actionError` is set:

```tsx
{actionError && (
  <div className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
    <XCircleIcon size={16} className="text-red-500 flex-shrink-0" />
    <p className="text-sm text-red-700 dark:text-red-300 flex-1">{actionError}</p>
    <button
      onClick={() => setActionError(null)}
      className="text-red-400 hover:text-red-600 transition-colors"
      aria-label="Dismiss error"
    >
      <XCircleIcon size={14} />
    </button>
  </div>
)}
```

#### 5. `step_failed` display for failed rows

When `status === 'failed'`, the row renders an error detail section only when at least one of `step_failed` or `error_message` is a non-empty string. `step_failed` is displayed first, labelled "Failed step:", followed by `error_message`.

```tsx
{exec.status === 'failed' && (exec.step_failed || exec.error_message) && (
  <div className="mt-1 space-y-0.5">
    {exec.step_failed && (
      <p className="text-xs text-red-500">
        <span className="font-medium">Failed step:</span> {exec.step_failed}
      </p>
    )}
    {exec.error_message && (
      <p className="text-xs text-red-400 truncate max-w-xs">{exec.error_message}</p>
    )}
  </div>
)}
```

The existing inline `error_message` display (which was outside the `flex` row) is replaced by this block, which lives inside the `<div className="flex-1 min-w-0">` container so it stays aligned with the pipeline name.

---

## Data Models

No schema changes. The relevant existing types:

```typescript
// frontend/src/types/index.ts (unchanged)
export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface PipelineExecution {
  id: string
  team_id?: string
  pipeline_name: string
  status: PipelineStatus
  started_at?: string
  completed_at?: string
  error_message?: string
  step_failed?: string          // ← already present, now surfaced in UI
  metadata: Record<string, unknown>
  created_at: string
}
```

---

## Interfaces

### Updated `workflowService.ts` exports

```typescript
// Existing (unchanged)
export interface PipelineStats { ... }
export async function getPipelineStats(teamId?: string): Promise<PipelineStats>
export async function getRecentExecutions(teamId?: string, limit?: number): Promise<PipelineExecution[]>

// New
export async function pausePipeline(id: string): Promise<boolean>
export async function resumePipeline(id: string): Promise<boolean>
export async function deletePipeline(id: string): Promise<boolean>
```

### `WorkflowDashboard.tsx` state shape

```typescript
// Existing
const [stats, setStats]           = useState<PipelineStats | null>(null)
const [executions, setExecutions] = useState<PipelineExecution[]>([])
const [loading, setLoading]       = useState<boolean>(true)

// New
const [actionInFlight, setActionInFlight] = useState<Set<string>>(new Set<string>())
const [actionError, setActionError]       = useState<string | null>(null)
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| `pausePipeline` / `resumePipeline` / `deletePipeline` PostgREST error | `reportError` called in service; function returns `false`; dashboard sets `actionError` and re-enables button |
| `pausePipeline` / `resumePipeline` / `deletePipeline` thrown exception | Caught by `try/catch (error: unknown)` in service; same as above |
| `getPipelineStats` or `getRecentExecutions` error | Existing handling unchanged — `reportError` called, defaults returned |
| `step_failed` and `error_message` both null/empty on a failed row | No error detail section rendered (conditional guard) |

---

## TypeScript Strict Mode Compliance

All changes must satisfy `npx tsc --noEmit` with zero errors:

- `Link` import removed from `WorkflowDashboard.tsx`
- All `catch` blocks use `catch (error: unknown)` — no `catch (error: any)`
- `useState<Set<string>>(new Set<string>())` — explicit generic avoids inference ambiguity
- `useState<string | null>(null)` — explicit generic for `actionError`
- `runAction` is typed `(id: string, fn: () => Promise<boolean>) => Promise<void>` — no implicit `any`
- `void` operator used on floating promises (`void load()`, `void runAction(...)`) to satisfy `@typescript-eslint/no-floating-promises`

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Pause and delete buttons present for active rows

*For any* `PipelineExecution` with `status` equal to `'running'` or `'pending'`, the rendered execution row SHALL contain both a pause action button and a delete action button.

**Validates: Requirements 1.1, 1.3**

---

### Property 2: Delete button present for all rows

*For any* `PipelineExecution` regardless of `status`, the rendered execution row SHALL contain a delete action button.

**Validates: Requirements 1.3**

---

### Property 3: pausePipeline issues correct PATCH for any id

*For any* non-empty string `id`, calling `pausePipeline(id)` SHALL issue a PostgREST PATCH to `pipeline_executions` setting `status` to `'pending'` for the row matching that `id`, and SHALL return `true` when the call succeeds.

**Validates: Requirements 2.1, 2.4**

---

### Property 4: resumePipeline issues correct PATCH for any id

*For any* non-empty string `id`, calling `resumePipeline(id)` SHALL issue a PostgREST PATCH to `pipeline_executions` setting `status` to `'running'` for the row matching that `id`, and SHALL return `true` when the call succeeds.

**Validates: Requirements 2.2, 2.4**

---

### Property 5: deletePipeline issues correct DELETE for any id

*For any* non-empty string `id`, calling `deletePipeline(id)` SHALL issue a PostgREST DELETE on `pipeline_executions` for the row matching that `id`, and SHALL return `true` when the call succeeds.

**Validates: Requirements 2.3, 2.4**

---

### Property 6: Mutation functions return false and call reportError on any PostgREST error

*For any* non-empty string `id` and any PostgREST error response, each of `pausePipeline`, `resumePipeline`, and `deletePipeline` SHALL call `reportError` with the function name and the error object, and SHALL return `false`.

**Validates: Requirements 2.5**

---

### Property 7: Failed execution row displays step_failed before error_message

*For any* `PipelineExecution` with `status` equal to `'failed'` where both `step_failed` and `error_message` are non-empty strings, the rendered row SHALL display `step_failed` before `error_message` in the DOM order.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 8: Stat cards reflect getPipelineStats output exactly

*For any* `PipelineStats` object returned by `getPipelineStats`, the rendered stat cards SHALL display `activePipelines`, `totalExecutions`, `successRate` (formatted as `"${n}%"`), and `estimatedTimeSavedHours` with values equal to those in the stats object — no hardcoded substitutions.

**Validates: Requirements 6.1, 6.3**

---

### Property 9: getPipelineStats derivation is consistent with raw rows

*For any* array of `pipeline_executions` rows, `getPipelineStats` SHALL return stats where:
- `totalExecutions` equals the total row count
- `activePipelines` equals the count of rows with `status` in `['running', 'pending']`
- `successRate` equals `Math.round((completedCount / totalCount) * 100)` (or `0` when total is `0`)
- `estimatedTimeSavedHours` equals `Math.round((completedCount * 15) / 60)`

**Validates: Requirements 6.2**

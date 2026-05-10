# Implementation Plan: mvp-workflow-dashboard

## Overview

Two files need targeted changes: `workflowService.ts` gets three new mutation functions (`pausePipeline`, `resumePipeline`, `deletePipeline`), and `WorkflowDashboard.tsx` gets action buttons per row, `step_failed` display for failed rows, removal of the unused `Link` import, and in-flight state tracking. No new dependencies are introduced — all data access continues through the existing `supabase` client singleton.

## Tasks

- [ ] 1. Add mutation functions to `workflowService.ts`
  - [ ] 1.1 Implement `pausePipeline`, `resumePipeline`, and `deletePipeline`
    - Add `pausePipeline(id: string): Promise<boolean>` — issues a PostgREST PATCH setting `status` to `'pending'` for the row matching `id`
    - Add `resumePipeline(id: string): Promise<boolean>` — issues a PostgREST PATCH setting `status` to `'running'` for the row matching `id`
    - Add `deletePipeline(id: string): Promise<boolean>` — issues a PostgREST DELETE for the row matching `id`
    - Each function must follow the existing pattern: `try/catch (error: unknown)`, call `reportError` on failure, return `true` on success and `false` on error
    - Use the `supabase` client from `../lib/supabase` as the sole HTTP mechanism — no `fetch` or `axios`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 1.2 Write property tests for `pausePipeline`, `resumePipeline`, and `deletePipeline`
    - **Property 3: pausePipeline issues correct PATCH for any id**
    - **Validates: Requirements 2.1, 2.4**
    - **Property 4: resumePipeline issues correct PATCH for any id**
    - **Validates: Requirements 2.2, 2.4**
    - **Property 5: deletePipeline issues correct DELETE for any id**
    - **Validates: Requirements 2.3, 2.4**
    - **Property 6: Mutation functions return false and call reportError on any PostgREST error**
    - **Validates: Requirements 2.5**

- [ ] 2. Update `WorkflowDashboard.tsx` — cleanup and state
  - [ ] 2.1 Remove unused `Link` import and add in-flight action state
    - Delete the `import { Link } from 'react-router-dom'` line entirely
    - Add `PauseIcon` and `Trash2Icon` to the existing `lucide-react` import (alongside the already-imported `PlayIcon`)
    - Import `pausePipeline`, `resumePipeline`, `deletePipeline` from `workflowService`
    - Add `const [actionInFlight, setActionInFlight] = useState<Set<string>>(new Set<string>())` state
    - Add `const [actionError, setActionError] = useState<string | null>(null)` state
    - Implement the `runAction` helper: wraps any action by adding the id to `actionInFlight`, awaiting the fn, removing the id, then either setting `actionError` or calling `void load()` on success
    - _Requirements: 4.1, 4.2, 5.1, 5.2_

- [ ] 3. Render action buttons and error UI in `WorkflowDashboard.tsx`
  - [ ] 3.1 Add pause, resume, and delete buttons to each execution row
    - Inside each execution row's `<div key={exec.id} ...>`, compute `const isInFlight = actionInFlight.has(exec.id)`
    - Render a pause button (yellow, `PauseIcon`) when `exec.status === 'running' || exec.status === 'pending'`; `disabled={isInFlight}`; calls `void runAction(exec.id, () => pausePipeline(exec.id))`
    - Render a resume button (blue, `PlayIcon`) when `exec.status === 'pending'`; `disabled={isInFlight}`; calls `void runAction(exec.id, () => resumePipeline(exec.id))`
    - Render a delete button (red, `Trash2Icon`) on every row regardless of status; `disabled={isInFlight}`; calls `void runAction(exec.id, () => deletePipeline(exec.id))`
    - All buttons must have `aria-label` attributes (`"Pause pipeline"`, `"Resume pipeline"`, `"Delete pipeline"`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 3.2 Add dismissible error notification banner
    - Render the error banner above the executions list when `actionError` is non-null
    - Banner uses `XCircleIcon`, displays `actionError` text, and has a dismiss button that calls `setActionError(null)` with `aria-label="Dismiss error"`
    - On action failure (`runAction` receives `false`), set `actionError` to `'Action failed. Please try again.'`
    - _Requirements: 1.7_

  - [ ]* 3.3 Write property tests for action button rendering
    - **Property 1: Pause and delete buttons present for active rows**
    - **Validates: Requirements 1.1, 1.3**
    - **Property 2: Delete button present for all rows**
    - **Validates: Requirements 1.3**

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Surface `step_failed` in failed execution rows
  - [ ] 5.1 Replace the existing inline `error_message` display with the combined `step_failed` + `error_message` block
    - Remove the existing `{exec.status === 'failed' && exec.error_message && (...)}` fragment that renders outside the flex container
    - Inside `<div className="flex-1 min-w-0">`, after the pipeline name and timestamp, add a conditional block that renders only when `exec.status === 'failed' && (exec.step_failed || exec.error_message)`
    - Within that block, render `step_failed` first (labelled `"Failed step:"`) when it is a non-empty string, then `error_message` below it when it is a non-empty string
    - When both are null/empty on a failed row, render no error detail section
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.2 Write property test for failed row error detail display order
    - **Property 7: Failed execution row displays step_failed before error_message**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [ ] 6. Verify TypeScript strict mode compliance
  - [ ] 6.1 Run `npx tsc --noEmit` and fix any errors in `workflowService.ts` and `WorkflowDashboard.tsx`
    - Confirm all `catch` blocks use `catch (error: unknown)` — no `catch (error: any)`
    - Confirm `useState<Set<string>>(new Set<string>())` and `useState<string | null>(null)` use explicit generics
    - Confirm `runAction` is typed `(id: string, fn: () => Promise<boolean>) => Promise<void>`
    - Confirm `void` operator is used on all floating promises (`void load()`, `void runAction(...)`)
    - Confirm `Link` import is absent from `WorkflowDashboard.tsx`
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The `runAction` helper is the single integration point between the UI buttons and the service layer — implement it in task 2.1 before wiring buttons in task 3.1
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- `step_failed` is already present on the `PipelineExecution` type in `frontend/src/types/index.ts` — no type changes are needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "3.1", "3.2"] },
    { "id": 2, "tasks": ["3.3", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1"] }
  ]
}
```

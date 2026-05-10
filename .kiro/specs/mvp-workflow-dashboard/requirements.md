# Requirements Document

## Introduction

The `mvp-workflow-dashboard` feature completes the `WorkflowDashboard.tsx` page for the Creozel platform. The dashboard is largely implemented; the remaining gaps are: adding pause/resume/delete action buttons to each pipeline execution row, implementing the corresponding `pausePipeline`, `resumePipeline`, and `deletePipeline` service functions in `workflowService.ts`, surfacing the `step_failed` field alongside `error_message` for failed executions, removing the unused `Link` import from `WorkflowDashboard.tsx`, and verifying TypeScript strict mode compliance across the affected files.

All pipeline statistics are derived from the `pipeline_executions` table via PostgREST. Row Level Security (RLS) enforces team data isolation, so no `activeTeamId` wiring is required in the frontend.

## Glossary

- **WorkflowDashboard**: The React page component at `frontend/src/pages/workflow/WorkflowDashboard.tsx` that displays pipeline statistics and recent execution rows.
- **workflowService**: The TypeScript service module at `frontend/src/services/workflowService.ts` that encapsulates all PostgREST calls for pipeline data.
- **PipelineExecution**: The TypeScript interface (defined in `frontend/src/types/index.ts`) that maps to a row in the `pipeline_executions` PostgreSQL table.
- **PipelineStatus**: The union type `'pending' | 'running' | 'completed' | 'failed'` representing the lifecycle state of a pipeline execution.
- **PostgREST**: The Supabase auto-generated REST API layer over PostgreSQL, accessed via the `supabase` client from `@supabase/supabase-js`.
- **RLS**: Row Level Security — PostgreSQL policies enforced by Supabase on every query, providing team data isolation without frontend `team_id` filtering.
- **step_failed**: A nullable string column on `pipeline_executions` that identifies which named step caused a pipeline failure.
- **error_message**: A nullable string column on `pipeline_executions` containing the human-readable error description for a failed execution.
- **Supabase client**: The singleton instance exported from `frontend/src/lib/supabase.ts`, used as the sole data access mechanism.
- **reportError**: The utility function from `frontend/src/utils/errorReporter.ts` used for structured error logging in service files.

## Requirements

### Requirement 1: Pipeline Action Buttons

**User Story:** As a team member, I want pause, resume, and delete buttons on each execution row, so that I can control running pipelines directly from the dashboard without navigating away.

#### Acceptance Criteria

1. WHEN the `WorkflowDashboard` renders an execution row with `status` equal to `'running'` or `'pending'`, THE `WorkflowDashboard` SHALL display a pause action button for that row.
2. WHEN the `WorkflowDashboard` renders an execution row with `status` equal to `'pending'` and the pipeline has previously been paused, THE `WorkflowDashboard` SHALL display a resume action button for that row.
3. THE `WorkflowDashboard` SHALL display a delete action button on every execution row regardless of `status`.
4. WHEN a user activates the pause button on an execution row, THE `WorkflowDashboard` SHALL call `pausePipeline` from `workflowService` with the execution's `id` and disable the button until the call resolves.
5. WHEN a user activates the resume button on an execution row, THE `WorkflowDashboard` SHALL call `resumePipeline` from `workflowService` with the execution's `id` and disable the button until the call resolves.
6. WHEN a user activates the delete button on an execution row, THE `WorkflowDashboard` SHALL call `deletePipeline` from `workflowService` with the execution's `id` and remove the row from the displayed list upon successful deletion.
7. IF `pausePipeline`, `resumePipeline`, or `deletePipeline` returns an error, THEN THE `WorkflowDashboard` SHALL display an error notification to the user and restore the button to its enabled state.
8. WHEN a pipeline action completes successfully, THE `WorkflowDashboard` SHALL reload the execution list by calling `getRecentExecutions` to reflect the updated state.

---

### Requirement 2: workflowService Pipeline Mutation Functions

**User Story:** As a developer, I want `pausePipeline`, `resumePipeline`, and `deletePipeline` functions in `workflowService.ts`, so that the dashboard has a clean service layer for pipeline lifecycle mutations.

#### Acceptance Criteria

1. THE `workflowService` SHALL export a `pausePipeline(id: string): Promise<boolean>` function that issues a PostgREST PATCH request to the `pipeline_executions` table setting `status` to `'pending'` for the row matching the given `id`.
2. THE `workflowService` SHALL export a `resumePipeline(id: string): Promise<boolean>` function that issues a PostgREST PATCH request to the `pipeline_executions` table setting `status` to `'running'` for the row matching the given `id`.
3. THE `workflowService` SHALL export a `deletePipeline(id: string): Promise<boolean>` function that issues a PostgREST DELETE request to the `pipeline_executions` table for the row matching the given `id`.
4. WHEN a PostgREST mutation call succeeds, THE `workflowService` SHALL return `true` from the corresponding function.
5. IF a PostgREST mutation call returns an error, THEN THE `workflowService` SHALL call `reportError` with the function name and the error object, and SHALL return `false`.
6. THE `workflowService` SHALL use the `supabase` client from `frontend/src/lib/supabase.ts` as the sole HTTP mechanism for all mutation calls — no `fetch` or `axios` calls are permitted.
7. WHILE a mutation function is executing, THE `workflowService` SHALL wrap the PostgREST call in a `try/catch` block using `catch (error: unknown)` with a type guard, consistent with the existing service pattern.

---

### Requirement 3: Failed Execution Error Detail Display

**User Story:** As a team member, I want to see both the failed step name and the error message for failed executions, so that I can diagnose pipeline failures without leaving the dashboard.

#### Acceptance Criteria

1. WHEN the `WorkflowDashboard` renders an execution row with `status` equal to `'failed'` and `step_failed` is a non-empty string, THE `WorkflowDashboard` SHALL display the `step_failed` value labelled as the failed step name.
2. WHEN the `WorkflowDashboard` renders an execution row with `status` equal to `'failed'` and `error_message` is a non-empty string, THE `WorkflowDashboard` SHALL display the `error_message` value.
3. WHEN the `WorkflowDashboard` renders an execution row with `status` equal to `'failed'` and both `step_failed` and `error_message` are present, THE `WorkflowDashboard` SHALL display both values within the same row, with `step_failed` appearing before `error_message`.
4. IF an execution row has `status` equal to `'failed'` but both `step_failed` and `error_message` are null or empty, THEN THE `WorkflowDashboard` SHALL render the row without an error detail section rather than displaying empty or null text.

---

### Requirement 4: Remove Unused Link Import

**User Story:** As a developer, I want the unused `Link` import removed from `WorkflowDashboard.tsx`, so that the file passes TypeScript strict mode checks and lint rules without warnings.

#### Acceptance Criteria

1. THE `WorkflowDashboard` module SHALL NOT contain an import of `Link` from `react-router-dom` unless `Link` is referenced in the component's JSX or logic.
2. WHEN `npx tsc --noEmit` is executed against the frontend project, THE TypeScript compiler SHALL report zero errors attributable to unused imports in `WorkflowDashboard.tsx`.

---

### Requirement 5: TypeScript Strict Mode Compliance

**User Story:** As a developer, I want all modified files to pass TypeScript strict mode checks, so that the codebase maintains type safety and `npx tsc --noEmit` exits with code 0.

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed against the frontend project, THE TypeScript compiler SHALL exit with code `0` with no errors in `WorkflowDashboard.tsx` or `workflowService.ts`.
2. THE `WorkflowDashboard` component SHALL declare all state variables with explicit types or types that TypeScript can infer without `any`.
3. THE `workflowService` module SHALL use `catch (error: unknown)` in all `catch` blocks — no `catch (error: any)` is permitted.
4. THE `WorkflowDashboard` component SHALL use `catch (error: unknown)` in any inline `catch` blocks — no `catch (error: any)` is permitted.
5. IF a variable in `WorkflowDashboard.tsx` or `workflowService.ts` requires narrowing from `unknown`, THEN THE developer SHALL use a type guard or `instanceof` check before accessing properties on the error value.

---

### Requirement 6: Stats Sourced Exclusively from PostgREST

**User Story:** As a product owner, I want all dashboard statistics to reflect live data from the `pipeline_executions` table, so that the dashboard is accurate and not misleading.

#### Acceptance Criteria

1. THE `WorkflowDashboard` SHALL derive all displayed stat values (`activePipelines`, `totalExecutions`, `successRate`, `estimatedTimeSavedHours`) exclusively from the `PipelineStats` object returned by `getPipelineStats`.
2. THE `workflowService.getPipelineStats` function SHALL compute all stat values by querying the `pipeline_executions` table via the `supabase` client — no hardcoded numeric values or mock data are permitted.
3. WHEN the `pipeline_executions` table contains zero rows, THE `WorkflowDashboard` SHALL display `0` for all stat cards rather than a placeholder string such as `'—'`.

# Implementation Plan: mvp-error-reporter

## Overview

This plan covers three discrete coding tasks: (1) write and document `errorReporter.ts` with full JSDoc, (2) run the TypeScript strict-mode check and fix any diagnostics, and (3) audit service files for stray `console.error` / `console.warn` calls and replace them with `reportError` / `reportWarning`. Property-based tests validate the four correctness properties defined in the design.

## Tasks

- [ ] 1. Implement and document `errorReporter.ts`
  - [ ] 1.1 Write the `errorReporter.ts` module
    - Create `frontend/src/utils/errorReporter.ts` (or overwrite if it already exists)
    - Define the `ErrorContext` type with an inline comment stating values must be JSON-serialisable for Sentry `extra`
    - Implement the internal `toError(value: unknown): Error` helper (coerces string → `new Error(string)`, non-Error → `new Error(JSON.stringify(value))`, Error → pass-through)
    - Implement `reportError(location: string, error: unknown, context?: ErrorContext)`:
      - DEV: `console.error('[Creozel Error] <location>:', err, context ?? '')`
      - PROD + Sentry present: `window.Sentry.captureException(err, { extra: { location, ...context } })` inside a try/catch
      - PROD + Sentry absent: silent no-op
    - Implement `reportWarning(location: string, message: string, context?: ErrorContext)`:
      - DEV: `console.warn('[Creozel Warning] <location>: <message>', context ?? '')`
      - PROD + Sentry present: `window.Sentry.captureMessage('<location>: <message>', { extra: context })` inside a try/catch
      - PROD + Sentry absent: silent no-op
    - Use the narrowly-typed `window` cast (`window as unknown as { Sentry?: ... }`) — no `@sentry/browser` npm import
    - _Requirements: 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ] 1.2 Add complete JSDoc documentation to `errorReporter.ts`
    - Add module-level JSDoc: environment routing description (DEV → console, PROD → Sentry), canonical usage example for `reportError`, canonical usage example for `reportWarning`
    - Add JSDoc to `reportError`: purpose (use in `catch` blocks for unexpected errors), `@param location`, `@param error`, `@param context`
    - Add JSDoc to `reportWarning`: purpose (degraded-but-recoverable states), `@param location`, `@param message`, `@param context`
    - Add inline comment on the Sentry CDN block explaining CDN loading and silent-failure wrapping
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 1.3 Write property-based tests for `reportError` Sentry forwarding
    - **Property 1: reportError forwards to Sentry in production with correct extra**
    - For arbitrary `location`, `error`, and `context`, when PROD and Sentry present, `captureException` is called exactly once with the coerced Error and `extra` containing `location` and all context entries
    - **Validates: Requirements 4.1, 4.4**

  - [ ]* 1.4 Write property-based tests for `reportWarning` Sentry forwarding
    - **Property 2: reportWarning forwards to Sentry in production with correct extra**
    - For arbitrary `location`, `message`, and `context`, when PROD and Sentry present, `captureMessage` is called exactly once with `'<location>: <message>'` and `extra` equal to `context`
    - **Validates: Requirements 4.2, 4.5**

  - [ ]* 1.5 Write property-based tests for absent Sentry never throwing
    - **Property 3: Absent Sentry never causes an exception**
    - For any error value, warning message, or context, when `window.Sentry` is `undefined`, both `reportError` and `reportWarning` complete without throwing and return `undefined`
    - **Validates: Requirements 4.3**

  - [ ]* 1.6 Write property-based tests for DEV mode never calling Sentry
    - **Property 4: DEV mode never calls Sentry**
    - For any error value, warning message, or context, when `import.meta.env.DEV` is `true`, neither `reportError` nor `reportWarning` invokes any method on `window.Sentry`, even when a Sentry object is present
    - **Validates: Requirements 4.6**

- [ ] 2. Checkpoint — verify `errorReporter.ts` compiles and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. TypeScript strict-mode compliance pass
  - [ ] 3.1 Run `npm run type-check` and fix all diagnostics
    - Run `cd frontend && npm run type-check` (i.e. `tsc --noEmit`)
    - For each diagnostic error reported, open the relevant file and resolve the type error
    - Common fixes: replace `catch (e: any)` with `catch (e: unknown)`, add missing return-type annotations, remove implicit `any` usages
    - Re-run `npm run type-check` until exit code is 0 with zero diagnostics
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 3.2 Write a unit test that asserts `tsc --noEmit` exits 0
    - Add a test (e.g. in `frontend/src/utils/__tests__/typecheck.test.ts`) that spawns `tsc --noEmit` as a child process and asserts exit code 0
    - _Requirements: 1.1_

- [ ] 4. Console audit — replace stray `console.error` / `console.warn` in service files
  - [ ] 4.1 Grep for unauthorised `console.error` / `console.warn` calls
    - Run the audit grep across `frontend/src/` excluding `errorReporter.ts` and `ErrorBoundary.tsx`
    - Produce a list of every file and line that contains a direct `console.error` or `console.warn` call
    - _Requirements: 2.1_

  - [ ] 4.2 Replace each stray call with `reportError` or `reportWarning`
    - For each match found in 4.1, open the file and replace the `console.error(...)` call with `reportError('<service>.<method>', error, { ...context })` and the `console.warn(...)` call with `reportWarning('<service>.<method>', message, { ...context })`
    - Ensure `import { reportError, reportWarning } from '@/utils/errorReporter'` is present at the top of each modified file
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.3 Write a unit test that asserts zero stray console calls remain
    - Add a test that reads all `.ts` / `.tsx` files under `frontend/src/` (excluding the two authorised files) and asserts none contain `console.error` or `console.warn`
    - _Requirements: 2.1_

- [ ] 5. Final checkpoint — Ensure all tests pass
  - Run `cd frontend && npm run type-check` and confirm exit code 0
  - Run the test suite and confirm all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the four universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- The `window.Sentry` CDN pattern must never be replaced with an npm import — the design explicitly forbids it

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["3.2", "4.2"] },
    { "id": 4, "tasks": ["4.3"] }
  ]
}
```

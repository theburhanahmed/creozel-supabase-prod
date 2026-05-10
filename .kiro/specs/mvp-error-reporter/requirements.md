# Requirements Document

## Introduction

This spec covers the verification and documentation of the `errorReporter` utility (`src/utils/errorReporter.ts`) in the Creozel frontend. The utility already exists and is in use across service files. The work required is: (1) verify TypeScript strict mode passes cleanly across the entire frontend, (2) audit that no `console.error` or `console.warn` calls remain in service files outside of `errorReporter.ts` and `ErrorBoundary.tsx`, and (3) produce inline JSDoc documentation that defines the usage contract for `reportError` and `reportWarning` so future contributors know exactly how and when to call each function.

## Glossary

- **ErrorReporter**: The module at `src/utils/errorReporter.ts` that exports `reportError` and `reportWarning`.
- **reportError**: The exported function used in `catch` blocks to capture unexpected errors.
- **reportWarning**: The exported function used to signal degraded-but-recoverable states.
- **ErrorContext**: The `Record<string, unknown>` type accepted as the optional third argument to both functions.
- **Sentry**: The error-monitoring service loaded via CDN (`window.Sentry`) in production; no npm package is used.
- **TypeScript strict mode**: The compiler configuration `"strict": true` already present in `frontend/tsconfig.json`.
- **Service file**: Any `.ts` or `.tsx` file under `src/` that is not `errorReporter.ts` or `ErrorBoundary.tsx`.
- **type-check script**: The `npm run type-check` script defined in `frontend/package.json` as `tsc --noEmit`.

## Requirements

### Requirement 1 — TypeScript Strict Mode Compliance

**User Story:** As a developer, I want `npm run type-check` to exit with code 0, so that the codebase is provably free of TypeScript type errors under strict mode.

#### Acceptance Criteria

1. WHEN the `type-check` script is executed (`tsc --noEmit`) against the `frontend/` directory, THE TypeScript Compiler SHALL exit with code 0 and produce zero diagnostic errors.
2. IF the `type-check` script produces any diagnostic errors, THEN THE Developer SHALL resolve each error before the feature is considered complete.
3. THE ErrorReporter module SHALL compile without errors under `"strict": true`, `"noImplicitAny": true` (implied by strict), and `"strictNullChecks": true` (implied by strict).

---

### Requirement 2 — Console Audit: No Direct console.error / console.warn in Service Files

**User Story:** As a developer, I want all error and warning output in service files to go through `reportError` or `reportWarning`, so that production noise is suppressed and Sentry receives consistent, structured events.

#### Acceptance Criteria

1. THE Codebase SHALL contain zero calls to `console.error` or `console.warn` in any service file under `src/` other than `src/utils/errorReporter.ts` and `src/components/ui/ErrorBoundary.tsx`.
2. WHEN a `console.error` or `console.warn` call is found in a service file during the audit, THE Developer SHALL replace it with the equivalent `reportError` or `reportWarning` call from `@/utils/errorReporter`.
3. THE ErrorReporter module SHALL remain the single authorised location for `console.error` and `console.warn` calls in the frontend source tree (development-mode logging only).

---

### Requirement 3 — Usage Contract Documentation

**User Story:** As a developer, I want `errorReporter.ts` to carry complete JSDoc documentation, so that I know exactly when to call `reportError` versus `reportWarning` and what each parameter means.

#### Acceptance Criteria

1. THE `reportError` function SHALL carry a JSDoc block that documents: its purpose (use in `catch` blocks for unexpected errors), the `location` parameter (a dot-separated string identifying the call site, e.g. `'dashboardService.getStats'`), the `error` parameter (accepts `unknown`; internally coerced to `Error`), and the optional `context` parameter (key-value pairs for additional diagnostic data).
2. THE `reportWarning` function SHALL carry a JSDoc block that documents: its purpose (use for degraded-but-recoverable states), the `location` parameter, the `message` parameter (a human-readable description of the warning), and the optional `context` parameter.
3. THE `ErrorContext` type SHALL carry an inline comment explaining that values must be JSON-serialisable so Sentry can attach them as `extra` data.
4. THE module-level JSDoc block SHALL document the environment-based behaviour: in development, output goes to the browser console; in production, output is forwarded to `window.Sentry` when available and console output is suppressed.
5. THE module-level JSDoc block SHALL include a canonical usage example for `reportError` and a canonical usage example for `reportWarning`.
6. WHERE the `window.Sentry` CDN fallback is used, THE ErrorReporter module SHALL include an inline comment explaining that Sentry is loaded via CDN (not npm) and that the call is wrapped in a try/catch to fail silently when Sentry is unavailable.

---

### Requirement 4 — Sentry Integration Contract

**User Story:** As a developer, I want the Sentry integration behaviour to be explicit and predictable, so that I can trust that errors are forwarded in production without introducing a hard dependency on the CDN script.

#### Acceptance Criteria

1. WHILE `import.meta.env.PROD` is `true`, THE ErrorReporter module SHALL attempt to call `window.Sentry.captureException` for every `reportError` invocation.
2. WHILE `import.meta.env.PROD` is `true`, THE ErrorReporter module SHALL attempt to call `window.Sentry.captureMessage` for every `reportWarning` invocation.
3. IF `window.Sentry` is `undefined` at the time of a `reportError` or `reportWarning` call, THEN THE ErrorReporter module SHALL silently skip the Sentry call and SHALL NOT throw an exception.
4. WHEN `reportError` forwards to Sentry, THE ErrorReporter module SHALL include `location` and all `context` key-value pairs in the Sentry `extra` object.
5. WHEN `reportWarning` forwards to Sentry, THE ErrorReporter module SHALL include the `context` object in the Sentry `extra` object.
6. WHILE `import.meta.env.DEV` is `true`, THE ErrorReporter module SHALL NOT forward events to Sentry.

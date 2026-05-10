# Design Document — mvp-error-reporter

## Overview

This feature is a verification and documentation pass over the existing `errorReporter` utility
(`src/utils/errorReporter.ts`). The module already exists and is already wired into every service
file. The work is three-pronged:

1. **TypeScript strict-mode compliance** — confirm `npm run type-check` exits 0 with zero
   diagnostics across the entire `frontend/` tree.
2. **Console audit** — confirm no `console.error` / `console.warn` calls remain in service files
   outside the two authorised locations (`errorReporter.ts` and `ErrorBoundary.tsx`).
3. **JSDoc documentation** — add or complete inline documentation so the usage contract for
   `reportError` and `reportWarning` is unambiguous to future contributors.

No new runtime behaviour is introduced. The design below describes the module's architecture as it
stands, the verification steps required, and the documentation additions needed.

---

## Architecture

### Module Boundary

```
frontend/src/
├── utils/
│   └── errorReporter.ts          ← single authorised source of console.error / console.warn
├── components/ui/
│   └── ErrorBoundary.tsx         ← authorised to call console.error (React lifecycle)
└── services/
    ├── authService.ts
    ├── calendarService.ts
    ├── contentService.ts
    ├── creditsService.ts
    ├── dashboardService.ts
    ├── mediaService.ts
    ├── notificationService.ts
    ├── settingsService.ts
    ├── socialService.ts
    ├── teamService.ts
    └── workflowService.ts        ← all catch blocks use reportError / reportWarning
```

All service files import from `@/utils/errorReporter` (path alias resolves via `tsconfig.json`
`paths`). No service file calls `console.*` directly.

### Environment Routing

```
reportError(location, error, context?)
reportWarning(location, message, context?)
         │
         ├─ import.meta.env.DEV ──► console.error / console.warn  (browser DevTools only)
         │
         └─ import.meta.env.PROD ─► window.Sentry?.captureException / captureMessage
                                     (CDN-loaded Sentry; absent → silent no-op)
```

The `window.Sentry` access is wrapped in a `try/catch` so a missing or broken CDN script never
propagates an exception to the caller.

---

## Components

### `errorReporter.ts` — Public API

#### `ErrorContext` type

```typescript
/**
 * Arbitrary key-value pairs attached to an error or warning report.
 * All values MUST be JSON-serialisable so Sentry can attach them as `extra` data.
 */
type ErrorContext = Record<string, unknown>
```

#### `toError(value: unknown): Error` (internal)

Coerces any caught value to an `Error` instance:
- If `value instanceof Error` → return as-is.
- If `value` is a `string` → `new Error(value)`.
- Otherwise → `new Error(JSON.stringify(value))`.

This ensures `reportError` always forwards a proper `Error` object to Sentry's
`captureException`, which expects an `Error`.

#### `reportError(location, error, context?)`

| Parameter  | Type            | Description |
|------------|-----------------|-------------|
| `location` | `string`        | Dot-separated call-site identifier, e.g. `'dashboardService.getStats'` |
| `error`    | `unknown`       | The caught value; internally coerced to `Error` via `toError()` |
| `context`  | `ErrorContext?` | Optional key-value pairs for additional diagnostic data |

Behaviour:
- **DEV**: `console.error('[Creozel Error] <location>:', err, context)`
- **PROD + Sentry present**: `window.Sentry.captureException(err, { extra: { location, ...context } })`
- **PROD + Sentry absent**: silent no-op

#### `reportWarning(location, message, context?)`

| Parameter  | Type            | Description |
|------------|-----------------|-------------|
| `location` | `string`        | Dot-separated call-site identifier |
| `message`  | `string`        | Human-readable description of the degraded state |
| `context`  | `ErrorContext?` | Optional key-value pairs for additional diagnostic data |

Behaviour:
- **DEV**: `console.warn('[Creozel Warning] <location>: <message>', context)`
- **PROD + Sentry present**: `window.Sentry.captureMessage('<location>: <message>', { extra: context })`
- **PROD + Sentry absent**: silent no-op

---

## Data Models

No new data models are introduced. The module operates entirely in memory and produces no
persistent state.

The `ErrorContext` type (`Record<string, unknown>`) is the only data contract. Values must be
JSON-serialisable because Sentry serialises the `extra` object when transmitting events to its
ingestion API.

---

## Interfaces

### Sentry CDN Shape (ambient, not imported)

The module accesses Sentry through a narrowly-typed window cast to avoid importing the Sentry npm
package:

```typescript
// reportError — Sentry access
const sentry = (window as unknown as {
  Sentry?: { captureException: (e: Error, ctx?: unknown) => void }
}).Sentry

// reportWarning — Sentry access
const sentry = (window as unknown as {
  Sentry?: { captureMessage: (m: string, ctx?: unknown) => void }
}).Sentry
```

This pattern:
- Avoids a hard npm dependency on `@sentry/browser`.
- Compiles cleanly under `strict: true` because the cast goes through `unknown`.
- Fails silently when the CDN script is absent or blocked.

---

## Verification Steps

### Step 1 — TypeScript Strict-Mode Check

```bash
cd frontend
npm run type-check   # tsc --noEmit
```

Expected: exit code 0, zero diagnostics. If any errors appear, resolve them before marking the
feature complete. The `tsconfig.json` already has `"strict": true` which implies
`noImplicitAny` and `strictNullChecks`.

### Step 2 — Console Audit

Run a static grep across `src/` excluding the two authorised files:

```bash
grep -rn "console\.\(error\|warn\)" frontend/src \
  --include="*.ts" --include="*.tsx" \
  --exclude="errorReporter.ts" \
  --exclude="ErrorBoundary.tsx"
```

Expected: zero matches. Any match must be replaced with the equivalent `reportError` or
`reportWarning` call.

### Step 3 — JSDoc Review

Open `src/utils/errorReporter.ts` and confirm the following documentation is present:

| Location | Required content |
|---|---|
| Module-level JSDoc | Environment routing description + canonical usage examples for both functions |
| `ErrorContext` | Inline comment: values must be JSON-serialisable for Sentry `extra` |
| `reportError` JSDoc | Purpose, `location`, `error`, `context` parameters |
| `reportWarning` JSDoc | Purpose, `location`, `message`, `context` parameters |
| Sentry CDN block | Inline comment explaining CDN loading and silent-failure wrapping |

---

## Error Handling

The module is itself the error-handling layer, so its own failure modes must be handled carefully:

| Scenario | Handling |
|---|---|
| `window.Sentry` is `undefined` | Guard check before call; no exception thrown |
| `window.Sentry.captureException` throws | Outer `try/catch` swallows the error silently |
| `toError` receives a non-serialisable value | `JSON.stringify` may produce `'[object Object]'`; acceptable — the Error message is still forwarded |
| Called in DEV with `context = undefined` | `context ?? ''` prevents `undefined` appearing in console output |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: reportError forwards to Sentry in production with correct extra

*For any* location string, error value, and context object, when `import.meta.env.PROD` is `true`
and `window.Sentry` is available, calling `reportError` SHALL invoke
`window.Sentry.captureException` exactly once with the coerced `Error` and an `extra` object
containing `location` and all entries from `context`.

**Validates: Requirements 4.1, 4.4**

---

### Property 2: reportWarning forwards to Sentry in production with correct extra

*For any* location string, warning message, and context object, when `import.meta.env.PROD` is
`true` and `window.Sentry` is available, calling `reportWarning` SHALL invoke
`window.Sentry.captureMessage` exactly once with the combined `'<location>: <message>'` string
and an `extra` object equal to `context`.

**Validates: Requirements 4.2, 4.5**

---

### Property 3: Absent Sentry never causes an exception

*For any* error value, warning message, or context object, when `window.Sentry` is `undefined`
(regardless of environment), calling `reportError` or `reportWarning` SHALL complete without
throwing an exception and SHALL return `undefined`.

**Validates: Requirements 4.3**

---

### Property 4: DEV mode never calls Sentry

*For any* error value, warning message, or context object, when `import.meta.env.DEV` is `true`,
calling `reportError` or `reportWarning` SHALL NOT invoke any method on `window.Sentry`, even
when a Sentry object is present on `window`.

**Validates: Requirements 4.6**

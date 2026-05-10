# Requirements — mvp-typescript-strict

## Introduction

TypeScript strict mode must be verified across the entire frontend codebase. `tsconfig.json` already has `"strict": true`. The task is to run `npx tsc --noEmit` and fix all reported errors, ensuring the codebase is type-safe before MVP launch.

## Glossary

- **strict mode**: TypeScript compiler option `"strict": true` which enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, and other checks
- **type-check script**: `npm run type-check` defined in `package.json` as `tsc --noEmit`

## Requirements

### Requirement 1 — Zero TypeScript Errors

**User Story:** As a developer, I want `npm run type-check` to exit with code 0, so that the codebase is provably free of type errors.

#### Acceptance Criteria

1. WHEN `npm run type-check` is executed from `frontend/`, THE TypeScript compiler SHALL exit with code 0 and produce zero diagnostic errors.
2. ALL `catch` blocks across the entire `frontend/src/` directory SHALL use `catch (error: unknown)` — no `catch (error: any)`.
3. NO file in `frontend/src/` SHALL use the `any` type explicitly unless it is a necessary type assertion with a comment explaining why.
4. ALL service functions SHALL have explicit return type annotations.

### Requirement 2 — CI Integration

**User Story:** As a DevOps engineer, I want the type-check to run on every PR.

#### Acceptance Criteria

1. THE CI pipeline SHALL include a step that runs `npm run type-check` in the `frontend/` directory.
2. IF the type-check fails, THE CI pipeline SHALL report a failing status check and output the TypeScript diagnostic errors.

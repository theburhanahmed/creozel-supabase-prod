# Design — mvp-typescript-strict

## Overview

This is a verification and cleanup task. The `tsconfig.json` already has `"strict": true`. The work is running `tsc --noEmit`, fixing all reported errors, and ensuring the CI pipeline includes the type-check step.

## Common Error Patterns to Fix

1. **`catch (error: any)`** → Replace with `catch (error: unknown)` + `instanceof Error` guard
2. **Implicit `any` return types** → Add explicit return type annotations to service functions
3. **Optional chaining on non-optional** → Remove unnecessary `?.` operators
4. **Missing null checks** → Add null guards before accessing properties on potentially null values
5. **Type assertion without `unknown`** → Use `as unknown as TargetType` pattern

## CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Type check
  working-directory: frontend
  run: npm run type-check
```

## Correctness Properties

- **Zero errors**: `npm run type-check` exits 0 with no diagnostics.
- **No `any` in catch blocks**: All catch blocks use `catch (error: unknown)`.

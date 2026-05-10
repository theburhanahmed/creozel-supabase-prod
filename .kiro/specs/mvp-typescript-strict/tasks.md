# Tasks — mvp-typescript-strict

- [ ] 1. Run `npm run type-check` and collect all errors
  - Run `cd frontend && npm run type-check 2>&1 | tee /tmp/tsc-errors.txt`
  - Review all reported errors and categorize them
  - **Validates:** Requirement 1.1

- [ ] 2. Fix all `catch (error: any)` occurrences
  - Search for `catch (error: any)` across `frontend/src/`
  - Replace each with `catch (error: unknown)` and add `instanceof Error` guard before accessing `error.message`
  - **Validates:** Requirement 1.2

- [ ] 3. Fix all implicit `any` and missing return types
  - Add explicit return type annotations to all service functions
  - Fix any implicit `any` usages flagged by the compiler
  - **Validates:** Requirements 1.3–1.4

- [ ] 4. Re-run type-check and confirm exit code 0
  - Run `npm run type-check` and confirm zero errors
  - **Validates:** Requirement 1.1

- [ ] 5. Add type-check step to CI pipeline
  - Add `npm run type-check` step to `.github/workflows/ci.yml` in the frontend job
  - **Validates:** Requirements 2.1–2.2

# Tasks — mvp-migration-docs

- [ ] 1. Create `docs/ops/` directory structure
  - Create `docs/ops/` directory if it doesn't exist
  - **Validates:** Requirement 1.1

- [ ] 2. Write `docs/ops/migration-rollback.md`
  - Overview section: explain forward-only migration philosophy
  - Rollback strategy section: compensating migrations vs. database restore
  - Step-by-step rollback procedure
  - Migration index table: list each file in `supabase/migrations/` with purpose and rollback notes
  - Emergency restore procedures using Supabase dashboard backup/restore
  - **Validates:** Requirements 1.1–1.5, 2.1

- [ ] 3. Add migration documentation reminder to CI
  - Add a comment in `.github/workflows/ci.yml` reminding developers to update `migration-rollback.md` when adding new migrations
  - **Validates:** Requirement 2.2

# Design — mvp-migration-docs

## Overview

Migration rollback documentation is missing from the project. This spec creates operational documentation covering how to roll back database migrations safely.

## Document Structure

`docs/ops/migration-rollback.md` should cover:

1. **Overview** — Why rollback documentation matters; Supabase migration philosophy (forward-only by default)
2. **Rollback Strategy** — Since PostgreSQL enum additions (`ADD VALUE`) are irreversible, the strategy is to write compensating migrations rather than true rollbacks
3. **Step-by-step rollback procedure** — How to identify the failing migration, write a compensating migration, and apply it
4. **Table of migrations** — Each migration file with its purpose and rollback notes
5. **Emergency procedures** — How to restore from a database backup if a migration causes data loss

## Correctness Properties

- **Documentation is accurate**: All migration filenames and descriptions match the actual files in `supabase/migrations/`
- **Rollback procedures are tested**: Each rollback procedure has been verified against a test database

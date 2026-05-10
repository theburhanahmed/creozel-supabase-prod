# Requirements — mvp-migration-docs

## Introduction

Migration rollback documentation is missing from the project. This spec creates the operational documentation needed for safe database migration management.

## Glossary

- **Migration**: A versioned SQL file in `supabase/migrations/` applied sequentially
- **Compensating migration**: A new migration that reverses the effect of a previous migration
- **Rollback**: The process of undoing a migration, either via compensating migration or database restore

## Requirements

### Requirement 1 — Migration Rollback Documentation

**User Story:** As a DevOps engineer, I want rollback documentation for each migration, so that I can safely undo schema changes if needed.

#### Acceptance Criteria

1. THE project SHALL contain a `docs/ops/migration-rollback.md` file.
2. THE document SHALL describe the rollback strategy for each migration file in `supabase/migrations/`.
3. THE document SHALL explain that PostgreSQL enum `ADD VALUE` operations are irreversible and require compensating migrations.
4. THE document SHALL include step-by-step instructions for applying a compensating migration.
5. THE document SHALL include emergency restore procedures using Supabase database backups.

### Requirement 2 — Migration Index

**User Story:** As a developer, I want a table of all migrations with their purpose and rollback notes.

#### Acceptance Criteria

1. THE `migration-rollback.md` document SHALL include a table listing each migration file, its purpose, and its rollback approach.
2. THE table SHALL be kept up to date when new migrations are added.

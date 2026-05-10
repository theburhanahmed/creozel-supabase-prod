# Requirements — mvp-team

## Introduction

The Team page (`Team.tsx`) is fully implemented with team creation, member invitation, role management, and member removal. The remaining gaps are: verifying `teamService.ts` is wired to real Supabase endpoints, adding invitation expiry handling, and TypeScript strict mode compliance.

## Glossary

- **Team**: Page at `frontend/src/pages/Team.tsx`
- **teamService**: Service at `frontend/src/services/teamService.ts`
- **TeamInvitation**: A row in `team_invitations` with a 7-day expiry

## Requirements

### Requirement 1 — Team Management

**User Story:** As a team owner, I want to create teams, invite members, change roles, and remove members.

#### Acceptance Criteria

1. THE `Team` page SHALL load teams via `getTeams(userId)` which queries `teams` joined with `team_members` for the authenticated user.
2. THE `inviteMember` function SHALL insert a row into `team_invitations` with `expires_at = now() + 7 days` and send an invitation email via Supabase's email system.
3. THE `updateMemberRole` function SHALL PATCH the `team_members` row with the new role.
4. THE `removeMember` function SHALL DELETE the `team_members` row.
5. THE `createTeam` function SHALL insert a row into `teams` and a corresponding `team_members` row with `role = 'owner'`.

### Requirement 2 — Invitation Expiry

**User Story:** As a team owner, I want invitations to expire after 7 days.

#### Acceptance Criteria

1. THE `team_invitations` table SHALL have an `expires_at` column set to `now() + interval '7 days'` on insert.
2. WHEN a user accepts an invitation, THE system SHALL check that `expires_at > now()` before creating the `team_members` row.
3. EXPIRED invitations SHALL NOT be shown in the team management UI.

### Requirement 3 — TypeScript Strict Mode

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed, THE TypeScript compiler SHALL exit with code 0 with no errors in `Team.tsx` or `teamService.ts`.
2. ALL `catch` blocks SHALL use `catch (error: unknown)` with `reportError`.

# Tasks — mvp-team

- [ ] 1. Verify `teamService.ts` is wired to real Supabase endpoints
  - Confirm `getTeams`, `getTeamMembers`, `inviteMember`, `updateMemberRole`, `removeMember`, `createTeam` all use `supabase` client
  - Confirm `inviteMember` sets `expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()`
  - Confirm `createTeam` inserts both a `teams` row and a `team_members` row with `role = 'owner'`
  - **Validates:** Requirements 1.1–1.5, 2.1

- [ ] 2. Add invitation expiry check to accept-invitation flow
  - If an `accept-invitation` Edge Function or route exists, verify it checks `expires_at > now()` before creating the `team_members` row
  - If not implemented, create a minimal `accept-invitation` Edge Function
  - **Validates:** Requirement 2.2

- [ ] 3. Filter expired invitations from UI
  - Verify the team invitations list (if shown) filters out rows where `expires_at < now()`
  - **Validates:** Requirement 2.3

- [ ] 4. TypeScript strict mode verification
  - Run `npx tsc --noEmit` from `frontend/`
  - Fix any errors in `Team.tsx` and `teamService.ts`
  - **Validates:** Requirements 3.1–3.2

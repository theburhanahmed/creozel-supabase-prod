# Design — mvp-team

## Overview

The Team page is fully implemented. The design documents the existing architecture and identifies the verification tasks needed.

## Architecture

```
Team.tsx
  ├── getTeams(userId)              → supabase.from('teams').select('*, team_members!inner(*)')
  ├── getTeamMembers(teamId)        → supabase.from('team_members').select('*, profiles(*)')
  ├── inviteMember(teamId, email, role) → supabase.from('team_invitations').insert(...)
  ├── updateMemberRole(memberId, role)  → supabase.from('team_members').update({ role })
  ├── removeMember(memberId)            → supabase.from('team_members').delete()
  └── createTeam(name, userId)          → supabase.from('teams').insert(...)
                                           + supabase.from('team_members').insert({ role: 'owner' })
```

## Correctness Properties

- **Owner cannot be removed**: The UI disables the remove button for `role === 'owner'` rows.
- **Role change is immediate**: RLS policies are re-evaluated on the next request after a role update.
- **Invitation expiry**: `expires_at` is set server-side; the UI filters out expired invitations.

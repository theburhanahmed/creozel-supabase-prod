-- Fix: allow the team owner to insert themselves as the initial owner member.
-- The existing "Team admins can insert members" policy requires is_team_admin(),
-- which checks team_members — creating a chicken-and-egg deadlock for new teams.
-- This policy covers the bootstrap case: the team owner adding themselves.
create policy "Team owner can insert themselves as owner member"
  on public.team_members for insert
  with check (
    role = 'owner'
    and user_id = auth.uid()
    and exists (
      select 1 from public.teams
      where id = team_id
        and owner_id = auth.uid()
    )
  );

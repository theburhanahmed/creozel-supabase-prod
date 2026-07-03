import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { Team, TeamMember, TeamInvitation, TeamRole } from '../types'

export async function getTeams(userId: string): Promise<Team[]> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('team_id, teams(*)')
      .eq('user_id', userId)
    if (error) { reportError('teamService.getTeams', error); return [] }
    return (data ?? []).map((row: { teams: unknown }) => row.teams as Team)
  } catch (error: unknown) {
    reportError('teamService.getTeams', error)
    return []
  }
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, profiles(id, display_name, email, avatar_url)')
      .eq('team_id', teamId)
    if (error) { reportError('teamService.getTeamMembers', error); return [] }
    return (data ?? []) as TeamMember[]
  } catch (error: unknown) {
    reportError('teamService.getTeamMembers', error)
    return []
  }
}

export async function inviteMember(teamId: string, email: string, role: TeamRole): Promise<boolean> {
  try {
    const { error } = await supabase.from('team_invitations').insert({ team_id: teamId, email, role })
    if (error) { reportError('teamService.inviteMember', error); return false }
    return true
  } catch (error: unknown) {
    reportError('teamService.inviteMember', error)
    return false
  }
}

export async function cancelInvitation(invitationId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('team_invitations').delete().eq('id', invitationId)
    if (error) { reportError('teamService.cancelInvitation', error); return false }
    return true
  } catch (error: unknown) {
    reportError('teamService.cancelInvitation', error)
    return false
  }
}

export async function updateMemberRole(memberId: string, role: TeamRole, teamId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('id', memberId)
      .eq('team_id', teamId)
    if (error) { reportError('teamService.updateMemberRole', error); return false }
    return true
  } catch (error: unknown) {
    reportError('teamService.updateMemberRole', error)
    return false
  }
}

export async function removeMember(memberId: string, teamId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('team_id', teamId)
    if (error) { reportError('teamService.removeMember', error); return false }
    return true
  } catch (error: unknown) {
    reportError('teamService.removeMember', error)
    return false
  }
}

export async function transferOwnership(teamId: string, newOwnerId: string): Promise<boolean> {
  try {
    const { data: oldOwner } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('role', 'owner')
      .maybeSingle()

    if (oldOwner) {
      const { error: demoteError } = await supabase
        .from('team_members')
        .update({ role: 'admin' })
        .eq('id', (oldOwner as { id: string }).id)
      if (demoteError) throw demoteError
    }

    const { error: promoteError } = await supabase
      .from('team_members')
      .update({ role: 'owner' })
      .eq('team_id', teamId)
      .eq('user_id', newOwnerId)
    if (promoteError) throw promoteError

    const { error: teamError } = await supabase
      .from('teams')
      .update({ owner_id: newOwnerId })
      .eq('id', teamId)
    if (teamError) throw teamError

    return true
  } catch (error: unknown) {
    reportError('teamService.transferOwnership', error)
    return false
  }
}

export async function createTeam(name: string, ownerId: string): Promise<Team | null> {
  try {
    const { data: team, error: teamError } = await supabase
      .from('teams').insert({ name, owner_id: ownerId }).select().single()
    if (teamError || !team) { reportError('teamService.createTeam', teamError); return null }
    await supabase.from('team_members').insert({ team_id: (team as Team).id, user_id: ownerId, role: 'owner' })
    return team as Team
  } catch (error: unknown) {
    reportError('teamService.createTeam', error)
    return null
  }
}

export async function getPendingInvitations(teamId: string): Promise<TeamInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('team_invitations').select('*').eq('team_id', teamId).is('accepted_at', null)
    if (error) { reportError('teamService.getPendingInvitations', error); return [] }
    return (data ?? []) as TeamInvitation[]
  } catch (error: unknown) {
    reportError('teamService.getPendingInvitations', error)
    return []
  }
}

/**
 * Accept a team invitation using the token from the invitation email.
 * Returns the joined team_id on success, or null on failure/expired invitation.
 */
export async function acceptInvitation(token: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .rpc('accept_team_invitation', { p_token: token })
      .single<string>()
    if (error) {
      reportError('teamService.acceptInvitation', error, { token })
      return null
    }
    return data
  } catch (error: unknown) {
    reportError('teamService.acceptInvitation', error, { token })
    return null
  }
}

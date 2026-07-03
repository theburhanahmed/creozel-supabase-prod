import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UsersIcon, PlusIcon, TrashIcon, MailIcon, CrownIcon } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import {
  getTeamMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  createTeam,
  getTeams,
  getPendingInvitations,
  cancelInvitation,
  transferOwnership,
} from '../services/teamService'
import type { TeamMember, TeamRole } from '../types'

const ROLES: TeamRole[] = ['owner', 'admin', 'editor', 'viewer']

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

export const Team: React.FC = () => {
  const { user, activeTeam, setActiveTeam, teams, setTeams } = useAppContext()
  const [localTeams, setLocalTeams] = useState(teams)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Array<{ id: string; email: string; role: TeamRole; expires_at: string | null }>>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('editor')
  const [newTeamName, setNewTeamName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState<string | null>(null)

  // Keep localTeams in sync with global teams prop
  useEffect(() => {
    setLocalTeams(teams)
  }, [teams])

  // Load teams for the selector on mount (defensive: global teams may not be loaded yet)
  useEffect(() => {
    if (!user) return
    void getTeams(user.id).then((fetched) => {
      setLocalTeams(fetched)
      setTeams(fetched)
      if (fetched.length > 0 && !activeTeam) {
        setActiveTeam(fetched[0])
      }
    })
  }, [user, activeTeam, setActiveTeam, setTeams])

  // Load members and invitations when the active team changes
  useEffect(() => {
    if (!activeTeam) {
      setMembers([])
      setInvitations([])
      setLoading(false)
      return
    }
    setLoading(true)
    void Promise.all([
      getTeamMembers(activeTeam.id),
      getPendingInvitations(activeTeam.id),
    ]).then(([m, i]) => {
      setMembers(m)
      setInvitations(i as typeof invitations)
      setLoading(false)
    })
  }, [activeTeam])

  const currentUserMember = members.find((m) => m.user_id === user?.id)
  const currentUserRole = currentUserMember?.role ?? 'viewer'
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin'
  const isOwner = currentUserRole === 'owner'

  const handleTeamSwitch = (teamId: string) => {
    const team = localTeams.find((t) => t.id === teamId)
    if (team) setActiveTeam(team)
  }

  const handleInvite = async () => {
    if (!activeTeam || !inviteEmail.trim() || !canManageMembers) return
    setInviting(true)
    const ok = await inviteMember(activeTeam.id, inviteEmail.trim(), inviteRole)
    setInviting(false)
    if (ok) {
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      const i = await getPendingInvitations(activeTeam.id)
      setInvitations(i as typeof invitations)
    } else {
      toast.error('Failed to send invitation')
    }
  }

  const handleRoleChange = async (member: TeamMember, role: TeamRole) => {
    if (!activeTeam) return
    if (!canManageMembers) {
      toast.error('You do not have permission to change roles')
      return
    }
    if (role === 'owner') {
      toast.error('Use transfer ownership to make someone an owner')
      return
    }
    const ok = await updateMemberRole(member.id, role, activeTeam.id)
    if (ok) setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role } : m)))
    else toast.error('Failed to update role')
  }

  const handleRemove = async (member: TeamMember) => {
    if (!activeTeam) return
    if (!canManageMembers) {
      toast.error('You do not have permission to remove members')
      return
    }
    const ok = await removeMember(member.id, activeTeam.id)
    if (ok) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
      toast.success('Member removed')
    } else {
      toast.error('Failed to remove member')
    }
  }

  const handleTransferOwnership = async (member: TeamMember) => {
    if (!isOwner || !activeTeam) {
      toast.error('Only the owner can transfer ownership')
      return
    }
    setTransferring(member.id)
    const ok = await transferOwnership(activeTeam.id, member.user_id)
    setTransferring(null)
    if (ok) {
      toast.success('Ownership transferred')
      const m = await getTeamMembers(activeTeam.id)
      setMembers(m)
    } else {
      toast.error('Failed to transfer ownership')
    }
  }

  const handleCreateTeam = async () => {
    if (!user || !newTeamName.trim()) return
    setCreating(true)
    const team = await createTeam(newTeamName.trim(), user.id)
    setCreating(false)
    if (team) {
      const updated = [...localTeams, team]
      setLocalTeams(updated)
      setTeams(updated)
      setActiveTeam(team)
      setNewTeamName('')
      toast.success('Team created')
    } else {
      toast.error('Failed to create team')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!canManageMembers || !activeTeam) return
    const ok = await cancelInvitation(invitationId)
    if (ok) {
      toast.success('Invitation cancelled')
      const i = await getPendingInvitations(activeTeam.id)
      setInvitations(i as typeof invitations)
    } else {
      toast.error('Failed to cancel invitation')
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-enhanced rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Team</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Manage your team members and invitations</p>
      </div>

      {/* Team selector + create */}
      <div className="glass-enhanced rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          {localTeams.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTeamSwitch(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTeam?.id === t.id ? 'bg-[#3FE0A5] text-white' : 'glass-light text-gray-700 dark:text-gray-300 hover:glass'}`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="New team name"
            className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]"
          />
          <button
            onClick={() => void handleCreateTeam()}
            disabled={creating || !newTeamName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50"
          >
            <PlusIcon size={16} /> Create Team
          </button>
        </div>
      </div>

      {activeTeam && (
        <>
          {/* Invite */}
          <div className="glass-enhanced rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Invite Member</h2>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <MailIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  disabled={!canManageMembers}
                  className="w-full pl-9 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] disabled:opacity-50"
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                disabled={!canManageMembers}
                className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5] disabled:opacity-50"
              >
                {ROLES.filter((r) => r !== 'owner').map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <button
                onClick={() => void handleInvite()}
                disabled={!canManageMembers || inviting || !inviteEmail.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50"
              >
                <PlusIcon size={16} /> Invite
              </button>
            </div>
            {!canManageMembers && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Only admins and owners can invite members.</p>
            )}
          </div>

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="glass-enhanced rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Pending Invitations</h2>
              <div className="space-y-2">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 glass-light rounded-xl">
                    <div className="flex items-center gap-3">
                      <MailIcon size={16} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{inv.email}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{ROLE_LABEL[inv.role]} • Expires {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : 'never'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => void handleCancelInvitation(inv.id)}
                      disabled={!canManageMembers}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="glass-enhanced rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
              Members ({members.length})
            </h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-[#3FE0A5]/30 border-t-[#3FE0A5] rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading members…</p>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8"><UsersIcon size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-sm text-gray-500 dark:text-gray-400">No members yet</p></div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => {
                  const profile = member.user
                  const isCurrentUser = member.user_id === user?.id
                  return (
                    <div key={member.id} className="flex items-center gap-3 p-3 glass-light rounded-xl">
                      <img
                        src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name ?? 'U')}&background=3FE0A5&color=fff`}
                        alt={profile?.display_name}
                        className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {profile?.display_name ?? 'Unknown'} {isCurrentUser && <span className="text-xs text-gray-400">(you)</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{profile?.email}</p>
                      </div>
                      <select
                        value={member.role}
                        onChange={(e) => void handleRoleChange(member, e.target.value as TeamRole)}
                        disabled={!canManageMembers || isCurrentUser || member.role === 'owner'}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 disabled:opacity-50"
                      >
                        {ROLES.filter((r) => r !== 'owner').map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                      {isOwner && !isCurrentUser && member.role !== 'owner' && (
                        <button
                          onClick={() => void handleTransferOwnership(member)}
                          disabled={transferring === member.id}
                          title="Transfer ownership"
                          className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                        >
                          <CrownIcon size={14} />
                        </button>
                      )}
                      {!isCurrentUser && member.role !== 'owner' && (
                        <button
                          onClick={() => void handleRemove(member)}
                          disabled={!canManageMembers}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UsersIcon, PlusIcon, TrashIcon, ChevronDownIcon, MailIcon } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { getTeamMembers, inviteMember, updateMemberRole, removeMember, createTeam, getTeams } from '../services/teamService'
import type { Team as TeamType, TeamMember, TeamRole } from '../types'

const ROLES: TeamRole[] = ['owner', 'admin', 'editor', 'viewer']

export const Team: React.FC = () => {
  const { user } = useAppContext()
  const [teams, setTeams]           = useState<TeamType[]>([])
  const [activeTeam, setActiveTeam] = useState<TeamType | null>(null)
  const [members, setMembers]       = useState<TeamMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<TeamRole>('editor')
  const [newTeamName, setNewTeamName] = useState('')
  const [loading, setLoading]         = useState(true)
  const [inviting, setInviting]       = useState(false)
  const [creating, setCreating]       = useState(false)

  useEffect(() => {
    if (!user) return
    void getTeams(user.id).then((t) => {
      setTeams(t)
      if (t.length > 0) setActiveTeam(t[0])
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!activeTeam) return
    void getTeamMembers(activeTeam.id).then(setMembers)
  }, [activeTeam])

  const handleInvite = async () => {
    if (!activeTeam || !inviteEmail.trim()) return
    setInviting(true)
    const ok = await inviteMember(activeTeam.id, inviteEmail.trim(), inviteRole)
    setInviting(false)
    if (ok) { toast.success(`Invitation sent to ${inviteEmail}`); setInviteEmail('') }
    else toast.error('Failed to send invitation')
  }

  const handleRoleChange = async (member: TeamMember, role: TeamRole) => {
    const ok = await updateMemberRole(member.id, role)
    if (ok) setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role } : m))
    else toast.error('Failed to update role')
  }

  const handleRemove = async (member: TeamMember) => {
    const ok = await removeMember(member.id)
    if (ok) { setMembers((prev) => prev.filter((m) => m.id !== member.id)); toast.success('Member removed') }
    else toast.error('Failed to remove member')
  }

  const handleCreateTeam = async () => {
    if (!user || !newTeamName.trim()) return
    setCreating(true)
    const team = await createTeam(newTeamName.trim(), user.id)
    setCreating(false)
    if (team) { setTeams((prev) => [...prev, team as TeamType]); setActiveTeam(team as TeamType); setNewTeamName(''); toast.success('Team created') }
    else toast.error('Failed to create team')
  }

  return (
    <div className="space-y-6">
      <div className="glass-enhanced rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Team</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Manage your team members and invitations</p>
      </div>

      {/* Team selector + create */}
      <div className="glass-enhanced rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          {teams.map((t) => (
            <button key={t.id} onClick={() => setActiveTeam(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTeam?.id === t.id ? 'bg-[#3FE0A5] text-white' : 'glass-light text-gray-700 dark:text-gray-300 hover:glass'}`}>
              {t.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="New team name" className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]" />
          <button onClick={() => void handleCreateTeam()} disabled={creating || !newTeamName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
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
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full pl-9 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]" />
              </div>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]">
                {ROLES.filter((r) => r !== 'owner').map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              <button onClick={() => void handleInvite()} disabled={inviting || !inviteEmail.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
                <PlusIcon size={16} /> Invite
              </button>
            </div>
          </div>

          {/* Members list */}
          <div className="glass-enhanced rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
              Members ({members.length})
            </h2>
            {members.length === 0 ? (
              <div className="text-center py-8"><UsersIcon size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-sm text-gray-500 dark:text-gray-400">No members yet</p></div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => {
                  const profile = member.user
                  const isCurrentUser = member.user_id === user?.id
                  return (
                    <div key={member.id} className="flex items-center gap-3 p-3 glass-light rounded-xl">
                      <img src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name ?? 'U')}&background=3FE0A5&color=fff`}
                        alt={profile?.display_name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{profile?.display_name ?? 'Unknown'} {isCurrentUser && <span className="text-xs text-gray-400">(you)</span>}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{profile?.email}</p>
                      </div>
                      <select value={member.role} onChange={(e) => void handleRoleChange(member, e.target.value as TeamRole)}
                        disabled={isCurrentUser || member.role === 'owner'}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 disabled:opacity-50">
                        {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
                      {!isCurrentUser && member.role !== 'owner' && (
                        <button onClick={() => void handleRemove(member)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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

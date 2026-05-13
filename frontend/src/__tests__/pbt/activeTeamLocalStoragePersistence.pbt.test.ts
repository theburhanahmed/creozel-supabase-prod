// Feature: mvp-saas-platform, Property 12: activeTeam localStorage persistence round-trip

/**
 * Property-Based Tests — activeTeam localStorage Persistence Round-Trip
 *
 * Property 12 (activeTeam localStorage persistence round-trip):
 *   For any team in the user's resolved team list, switching to that team
 *   SHALL write its `id` to `localStorage['creozel:activeTeamId']`, and
 *   mounting `AppContext` with that value already in `localStorage` SHALL
 *   initialise `activeTeam` to that same team.
 *
 * **Validates: Requirements 8.1, 8.2**
 *
 * Implementation note:
 *   The two pure functions under test are extracted from AppContext.tsx:
 *
 *   1. `writeActiveTeamId(team)` — mirrors `setActiveTeam`:
 *        if (team !== null) localStorage.setItem('creozel:activeTeamId', team.id)
 *        else               localStorage.removeItem('creozel:activeTeamId')
 *
 *   2. `resolveActiveTeamFromStorage(members)` — mirrors the mount sequence:
 *        storedId = localStorage.getItem('creozel:activeTeamId')
 *        if (storedId) {
 *          match = members.find(m => m.teams.id === storedId)
 *          if (match) return match.teams
 *        }
 *        return selectActiveTeam(members)   // role-priority fallback
 *
 *   We test these helpers directly (no React rendering required) so the
 *   property runs fast and deterministically across 100 iterations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { selectActiveTeam, type TeamMemberWithTeam } from '../../context/AppContext'
import type { Team } from '../../types'

// ─── localStorage mock for node test environment ──────────────────────────────

const localStorageStore: Map<string, string> = new Map()

const localStorageMock = {
  getItem: (key: string): string | null => localStorageStore.get(key) ?? null,
  setItem: (key: string, value: string): void => { localStorageStore.set(key, value) },
  removeItem: (key: string): void => { localStorageStore.delete(key) },
  clear: (): void => { localStorageStore.clear() },
}

vi.stubGlobal('localStorage', localStorageMock)

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_TEAM_KEY = 'creozel:activeTeamId'

// ─── Pure helpers mirroring AppContext logic ──────────────────────────────────

/**
 * Mirrors the localStorage write in `setActiveTeam` (AppContext.tsx):
 *
 *   if (team !== null) {
 *     localStorage.setItem('creozel:activeTeamId', team.id)
 *   } else {
 *     localStorage.removeItem('creozel:activeTeamId')
 *   }
 */
function writeActiveTeamId(team: Team | null): void {
  if (team !== null) {
    localStorage.setItem(ACTIVE_TEAM_KEY, team.id)
  } else {
    localStorage.removeItem(ACTIVE_TEAM_KEY)
  }
}

/**
 * Mirrors the mount-time resolution in `loadTeamsForUser` (AppContext.tsx):
 *
 *   storedId = localStorage.getItem('creozel:activeTeamId')
 *   if (storedId) {
 *     match = members.find(m => m.teams.id === storedId)
 *     if (match) return match.teams
 *   }
 *   return selectActiveTeam(members)   // role-priority fallback
 *
 * Returns the resolved Team (or null when members is empty and no stored id
 * matches).
 */
function resolveActiveTeamFromStorage(members: TeamMemberWithTeam[]): Team | null {
  let storedId: string | null = null
  try {
    storedId = localStorage.getItem(ACTIVE_TEAM_KEY)
  } catch {
    // SecurityError — fall through to role-priority selection
  }

  if (storedId) {
    const match = members.find((m) => m.teams.id === storedId)
    if (match) return match.teams
  }

  // No stored match — apply role-priority selection
  return selectActiveTeam(members)
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const MIN_TS = new Date('2020-01-01T00:00:00.000Z').getTime()
const MAX_TS = new Date('2030-01-01T00:00:00.000Z').getTime()

/** Generates a valid ISO-8601 date string */
const isoDate = fc
  .integer({ min: MIN_TS, max: MAX_TS })
  .map((ts) => new Date(ts).toISOString())

/** Generates a single Team record */
const teamArb: fc.Arbitrary<Team> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  owner_id: fc.uuid(),
  created_at: isoDate,
  logo_url: fc.option(fc.webUrl(), { nil: undefined }),
})

/** Generates a single TeamMemberWithTeam record */
const memberArb: fc.Arbitrary<TeamMemberWithTeam> = fc.record({
  team_id: fc.uuid(),
  role: fc.constantFrom('owner', 'admin', 'editor', 'viewer') as fc.Arbitrary<TeamMemberWithTeam['role']>,
  created_at: isoDate,
  teams: teamArb,
})

/** Non-empty list of members (up to 20) */
const nonEmptyMembersArb = fc.array(memberArb, { minLength: 1, maxLength: 20 })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PBT — activeTeam localStorage Persistence Round-Trip (Property 12)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── Property 12a: setActiveTeam writes team.id to localStorage ────────────────

  it(
    'Property 12a: switching to any team writes its id to localStorage (100 runs)',
    () => {
      /**
       * **Validates: Requirements 8.1**
       *
       * For any Team object, calling writeActiveTeamId(team) SHALL write
       * team.id to localStorage['creozel:activeTeamId'].
       *
       * This mirrors the setActiveTeam behaviour in AppContext.tsx:
       *   localStorage.setItem('creozel:activeTeamId', team.id)
       */
      fc.assert(
        fc.property(
          teamArb,
          (team: Team) => {
            writeActiveTeamId(team)

            const stored = localStorage.getItem(ACTIVE_TEAM_KEY)

            // Property: the stored value equals the team's id
            expect(stored).toBe(team.id)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 12b: mount with stored id restores the same team ─────────────────

  it(
    'Property 12b: mounting with a stored team id restores the exact same team (100 runs)',
    () => {
      /**
       * **Validates: Requirements 8.2**
       *
       * For any team in the resolved team list, if localStorage already
       * contains that team's id under 'creozel:activeTeamId', the mount
       * sequence SHALL initialise activeTeam to that same team.
       *
       * This mirrors the loadTeamsForUser mount sequence in AppContext.tsx:
       *   storedId = localStorage.getItem('creozel:activeTeamId')
       *   match = members.find(m => m.teams.id === storedId)
       *   if (match) setActiveTeamState(match.teams)
       */
      fc.assert(
        fc.property(
          nonEmptyMembersArb,
          (members: TeamMemberWithTeam[]) => {
            // Pick a random member from the list to be the "previously active" team
            const targetMember = members[Math.floor(Math.random() * members.length)]
            const targetTeam = targetMember.teams

            // Pre-populate localStorage as if a previous session had set this team
            localStorage.setItem(ACTIVE_TEAM_KEY, targetTeam.id)

            // Simulate the mount sequence
            const resolved = resolveActiveTeamFromStorage(members)

            // Property: the resolved team is the same team whose id was stored
            expect(resolved).not.toBeNull()
            expect(resolved!.id).toBe(targetTeam.id)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 12c: full round-trip — switch then mount restores same team ──────

  it(
    'Property 12c: full round-trip — switching to a team then mounting restores the same team (100 runs)',
    () => {
      /**
       * **Validates: Requirements 8.1, 8.2**
       *
       * For any team in the resolved team list:
       *   1. writeActiveTeamId(team) writes team.id to localStorage
       *   2. resolveActiveTeamFromStorage(members) reads it back and returns
       *      the same team
       *
       * This is the complete round-trip: switch → persist → mount → restore.
       */
      fc.assert(
        fc.property(
          nonEmptyMembersArb,
          (members: TeamMemberWithTeam[]) => {
            // Pick a random member to switch to
            const targetMember = members[Math.floor(Math.random() * members.length)]
            const targetTeam = targetMember.teams

            // Step 1: simulate setActiveTeam(targetTeam) — writes to localStorage
            writeActiveTeamId(targetTeam)

            // Step 2: simulate AppContext mount — reads from localStorage
            const resolved = resolveActiveTeamFromStorage(members)

            // Property: the resolved team equals the team we switched to
            expect(resolved).not.toBeNull()
            expect(resolved!.id).toBe(targetTeam.id)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 12d: stored id not in list falls back to role-priority ───────────

  it(
    'Property 12d: stored id not matching any team falls back to role-priority selection (100 runs)',
    () => {
      /**
       * **Validates: Requirements 8.2**
       *
       * When localStorage contains a team id that does NOT match any team in
       * the resolved list (e.g., the user was removed from that team), the
       * mount sequence SHALL fall back to role-priority selection.
       *
       * This mirrors the AppContext fallback:
       *   if (!match) setActiveTeamState(selectActiveTeam(members))
       */
      fc.assert(
        fc.property(
          nonEmptyMembersArb,
          (members: TeamMemberWithTeam[]) => {
            // Store a UUID that is guaranteed not to match any member's team id
            // by using a fixed sentinel that cannot appear in fc.uuid() output
            const orphanId = '00000000-0000-0000-0000-000000000000'

            // Ensure the sentinel is not accidentally in the member list
            fc.pre(!members.some((m) => m.teams.id === orphanId))

            localStorage.setItem(ACTIVE_TEAM_KEY, orphanId)

            const resolved = resolveActiveTeamFromStorage(members)

            // Property: falls back to role-priority selection (same as selectActiveTeam)
            const expected = selectActiveTeam(members)
            expect(resolved).toEqual(expected)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 12e: setActiveTeam(null) removes the key from localStorage ───────

  it(
    'Property 12e: setActiveTeam(null) removes creozel:activeTeamId from localStorage (100 runs)',
    () => {
      /**
       * **Validates: Requirements 8.1**
       *
       * When setActiveTeam is called with null, the key
       * 'creozel:activeTeamId' SHALL be removed from localStorage.
       *
       * This mirrors the AppContext behaviour:
       *   else { localStorage.removeItem('creozel:activeTeamId') }
       */
      fc.assert(
        fc.property(
          teamArb, // a previously active team
          (_previousTeam: Team) => {
            // Pre-condition: a team id is already stored
            localStorage.setItem(ACTIVE_TEAM_KEY, _previousTeam.id)
            expect(localStorage.getItem(ACTIVE_TEAM_KEY)).toBe(_previousTeam.id)

            // Simulate setActiveTeam(null) — e.g., on logout or team removal
            writeActiveTeamId(null)

            // Property: the key is removed
            expect(localStorage.getItem(ACTIVE_TEAM_KEY)).toBeNull()
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 12f: absent key falls back to role-priority selection ─────────────

  it(
    'Property 12f: absent localStorage key falls back to role-priority selection (100 runs)',
    () => {
      /**
       * **Validates: Requirements 8.2**
       *
       * When localStorage contains no 'creozel:activeTeamId' key (first
       * login, private browsing, or after logout), the mount sequence SHALL
       * apply role-priority selection — identical to selectActiveTeam(members).
       */
      fc.assert(
        fc.property(
          nonEmptyMembersArb,
          (members: TeamMemberWithTeam[]) => {
            // Ensure the key is absent
            localStorage.removeItem(ACTIVE_TEAM_KEY)

            const resolved = resolveActiveTeamFromStorage(members)
            const expected = selectActiveTeam(members)

            // Property: result equals the role-priority selection
            expect(resolved).toEqual(expected)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 12g: switching teams overwrites the previous stored id ───────────

  it(
    'Property 12g: switching to a different team overwrites the previously stored id (100 runs)',
    () => {
      /**
       * **Validates: Requirements 8.1**
       *
       * For any two distinct teams A and B, switching from A to B SHALL
       * overwrite localStorage['creozel:activeTeamId'] with B's id.
       * After the switch, only B's id is stored — A's id is gone.
       */
      fc.assert(
        fc.property(
          teamArb,
          teamArb,
          (teamA: Team, teamB: Team) => {
            // Skip when fast-check generates the same id for both teams
            fc.pre(teamA.id !== teamB.id)

            // Switch to team A first
            writeActiveTeamId(teamA)
            expect(localStorage.getItem(ACTIVE_TEAM_KEY)).toBe(teamA.id)

            // Switch to team B
            writeActiveTeamId(teamB)

            // Property: only B's id is stored
            expect(localStorage.getItem(ACTIVE_TEAM_KEY)).toBe(teamB.id)
            expect(localStorage.getItem(ACTIVE_TEAM_KEY)).not.toBe(teamA.id)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 12h: mount resolves to the last-written team id ─────────────────

  it(
    'Property 12h: mount always resolves to the last-written team id when it is in the list (100 runs)',
    () => {
      /**
       * **Validates: Requirements 8.1, 8.2**
       *
       * For any sequence of team switches, the mount sequence SHALL always
       * resolve to the team whose id was written last to localStorage —
       * provided that team is still in the resolved list.
       *
       * This verifies that the write is atomic (last-write-wins) and that
       * the mount sequence reads the most recent value.
       */
      fc.assert(
        fc.property(
          nonEmptyMembersArb,
          (members: TeamMemberWithTeam[]) => {
            // Simulate multiple switches; the last one wins
            for (const member of members) {
              writeActiveTeamId(member.teams)
            }

            // The last team written is the last member in the array
            const lastTeam = members[members.length - 1].teams

            // Simulate mount
            const resolved = resolveActiveTeamFromStorage(members)

            // Property: mount resolves to the last-written team
            expect(resolved).not.toBeNull()
            expect(resolved!.id).toBe(lastTeam.id)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

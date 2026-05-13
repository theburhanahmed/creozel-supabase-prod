// Feature: mvp-saas-platform, Property 1: Active team selection by role priority

/**
 * Validates: Requirements 1.2, 8.3
 *
 * Property 1: For any list of team memberships with varying roles and
 * `created_at` timestamps, `selectActiveTeam` SHALL always return the team
 * with the highest role priority (owner > admin > editor > viewer), using
 * the earliest `created_at` as a tiebreaker when roles are equal.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { selectActiveTeam, type TeamMemberWithTeam } from '../../context/AppContext'

// ─── Role priority map (mirrors the implementation) ──────────────────────────

const ROLE_PRIORITY = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
} as const

type TeamRole = keyof typeof ROLE_PRIORITY

// ─── Arbitraries ─────────────────────────────────────────────────────────────

// Use integer timestamps to avoid fast-check v4 date shrinking issues.
// Range: 2020-01-01 to 2030-01-01 in milliseconds.
const MIN_TS = new Date('2020-01-01T00:00:00.000Z').getTime()
const MAX_TS = new Date('2030-01-01T00:00:00.000Z').getTime()

/** Generates a valid ISO-8601 date string */
const isoDate = fc
  .integer({ min: MIN_TS, max: MAX_TS })
  .map((ts) => new Date(ts).toISOString())

/** Generates a single TeamMemberWithTeam record */
const memberArb: fc.Arbitrary<TeamMemberWithTeam> = fc.record({
  team_id: fc.uuid(),
  role: fc.constantFrom<TeamRole>('owner', 'admin', 'editor', 'viewer'),
  created_at: isoDate,
  teams: fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    owner_id: fc.uuid(),
    created_at: isoDate,
    logo_url: fc.option(fc.webUrl(), { nil: undefined }),
  }),
})

/** Non-empty list of members */
const nonEmptyMembersArb = fc.array(memberArb, { minLength: 1, maxLength: 20 })

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Property 1 — selectActiveTeam: team selection by role priority', () => {
  it('returns null for an empty membership list', () => {
    expect(selectActiveTeam([])).toBeNull()
  })

  it('always returns the team with the highest role priority (100 runs)', () => {
    fc.assert(
      fc.property(nonEmptyMembersArb, (members) => {
        const selected = selectActiveTeam(members)

        // Must return a non-null team when the list is non-empty
        expect(selected).not.toBeNull()

        // Determine the maximum priority present in the list
        const maxPriority = Math.max(
          ...members.map((m) => ROLE_PRIORITY[m.role as TeamRole]),
        )

        // Find the member whose team was selected
        const selectedMember = members.find((m) => m.teams.id === selected!.id)
        expect(selectedMember).toBeDefined()

        // The selected member must have the maximum priority
        expect(ROLE_PRIORITY[selectedMember!.role as TeamRole]).toBe(maxPriority)
      }),
      { numRuns: 100 },
    )
  })

  it('uses earliest created_at as tiebreaker when roles are equal (100 runs)', () => {
    // Generate lists where all members share the same role so the tiebreaker
    // is the only differentiator.
    const sameRoleMembersArb = fc
      .constantFrom<TeamRole>('owner', 'admin', 'editor', 'viewer')
      .chain((role) =>
        fc.array(
          fc.record({
            team_id: fc.uuid(),
            role: fc.constant(role),
            created_at: isoDate,
            teams: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              owner_id: fc.uuid(),
              created_at: isoDate,
              logo_url: fc.option(fc.webUrl(), { nil: undefined }),
            }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
      )

    fc.assert(
      fc.property(sameRoleMembersArb, (members) => {
        const selected = selectActiveTeam(members)
        expect(selected).not.toBeNull()

        // Find the member with the earliest created_at
        const earliest = members.reduce((best, m) =>
          new Date(m.created_at).getTime() < new Date(best.created_at).getTime()
            ? m
            : best,
        )

        expect(selected!.id).toBe(earliest.teams.id)
      }),
      { numRuns: 100 },
    )
  })

  it('returns the single member\'s team when the list has exactly one entry', () => {
    fc.assert(
      fc.property(memberArb, (member) => {
        const selected = selectActiveTeam([member])
        expect(selected).toEqual(member.teams)
      }),
      { numRuns: 100 },
    )
  })

  it('owner always beats admin, editor, and viewer regardless of created_at (100 runs)', () => {
    // Build a list that always contains at least one owner plus other roles
    const mixedArb = fc
      .tuple(
        // At least one owner
        fc.array(
          fc.record({
            team_id: fc.uuid(),
            role: fc.constant<TeamRole>('owner'),
            created_at: isoDate,
            teams: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              owner_id: fc.uuid(),
              created_at: isoDate,
              logo_url: fc.option(fc.webUrl(), { nil: undefined }),
            }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        // Zero or more non-owner members
        fc.array(
          fc.record({
            team_id: fc.uuid(),
            role: fc.constantFrom<TeamRole>('admin', 'editor', 'viewer'),
            created_at: isoDate,
            teams: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              owner_id: fc.uuid(),
              created_at: isoDate,
              logo_url: fc.option(fc.webUrl(), { nil: undefined }),
            }),
          }),
          { minLength: 0, maxLength: 10 },
        ),
      )
      .map(([owners, others]) => [...owners, ...others])

    fc.assert(
      fc.property(mixedArb, (members) => {
        const selected = selectActiveTeam(members)
        expect(selected).not.toBeNull()

        const selectedMember = members.find((m) => m.teams.id === selected!.id)
        expect(selectedMember!.role).toBe('owner')
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: mvp-saas-platform, Property 9: OAuth callback rejects invalid state

/**
 * Validates: Requirements 5.5
 *
 * Property 9: For any OAuth callback request where the `state` parameter is
 * absent, malformed (not valid base64 JSON), or contains an empty/missing
 * `team_id`, the `oauth-connect` Edge Function SHALL return HTTP 400 and
 * SHALL NOT insert any row into `social_connections`.
 *
 * Implementation note:
 *   The Edge Function runs in Deno/Supabase and cannot be invoked directly
 *   from Jest/Vitest. Instead, we extract and test the two pure validation
 *   steps that constitute Property 9:
 *
 *   Step 1 — State decoding (malformed state detection):
 *     try {
 *       stateData = JSON.parse(atob(state))
 *     } catch {
 *       return HTTP 400 { error: 'invalid_state' }   // ← no insert
 *     }
 *
 *   Step 2 — team_id validation (missing/empty team_id detection):
 *     if (!stateData.team_id || typeof stateData.team_id !== 'string' || stateData.team_id.trim() === '') {
 *       return HTTP 400 { error: 'team_id_required' }  // ← no insert
 *     }
 *
 *   The key invariant tested here is:
 *     invalid_state → HTTP 400 + supabaseCalled = false
 *
 *   This mirrors the exact logic in supabase/functions/oauth-connect/index.ts.
 *
 * Error responses from the design doc:
 *   - Missing/malformed state:  HTTP 400 { error: 'invalid_state' }
 *   - Missing/empty team_id:    HTTP 400 { error: 'team_id_required' }
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Types ────────────────────────────────────────────────────────────────────

/** The shape of a successfully decoded OAuth state payload */
interface OAuthStatePayload {
  platform: string
  redirect_uri: string
  user_id: string
  team_id: string
}

/** Possible outcomes of the Edge Function's state validation */
type ValidationResult =
  | { status: 400; error: 'invalid_state';    supabaseCalled: false }
  | { status: 400; error: 'team_id_required'; supabaseCalled: false }
  | { status: 'proceed';                      supabaseCalled: true; teamId: string }

// ─── Pure simulations of Edge Function validation logic ──────────────────────

/**
 * Simulates the full state validation performed by the `oauth-connect` Edge
 * Function during Phase 2 (callback):
 *
 *   // Step 1: decode state
 *   let stateData
 *   try {
 *     stateData = JSON.parse(atob(state))
 *   } catch {
 *     return new Response(JSON.stringify({ error: 'invalid_state' }), { status: 400 })
 *   }
 *
 *   // Step 2: validate team_id
 *   if (!stateData.team_id || typeof stateData.team_id !== 'string' || stateData.team_id.trim() === '') {
 *     return new Response(JSON.stringify({ error: 'team_id_required' }), { status: 400 })
 *   }
 *
 *   // Proceed to insert
 *   await supabase.from('social_connections').upsert({ team_id: stateData.team_id, ... })
 *
 * Returns a ValidationResult that captures the HTTP status, error code, and
 * whether Supabase would have been called.
 */
function validateOAuthState(state: string | null | undefined): ValidationResult {
  // Absent state (null/undefined/empty string) → invalid_state
  if (!state) {
    return { status: 400, error: 'invalid_state', supabaseCalled: false }
  }

  // Step 1: attempt to decode the state as base64 JSON
  let stateData: unknown
  try {
    stateData = JSON.parse(atob(state))
  } catch {
    // Malformed state (not valid base64, not valid JSON) → invalid_state
    return { status: 400, error: 'invalid_state', supabaseCalled: false }
  }

  // Step 2: validate team_id
  const payload = stateData as Partial<OAuthStatePayload>
  const teamId = payload.team_id

  if (!teamId || typeof teamId !== 'string' || teamId.trim() === '') {
    // Missing, null, empty, or whitespace-only team_id → team_id_required
    return { status: 400, error: 'team_id_required', supabaseCalled: false }
  }

  // All validations passed — Supabase insert would proceed
  return { status: 'proceed', supabaseCalled: true, teamId }
}

/**
 * Encodes a valid OAuth state payload as the frontend does:
 *   btoa(JSON.stringify(payload))
 */
function encodeOAuthState(payload: OAuthStatePayload): string {
  return btoa(JSON.stringify(payload))
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates absent state values: null, undefined, or empty string */
const absentStateArb: fc.Arbitrary<null | undefined | ''> = fc.oneof(
  fc.constant(null as null),
  fc.constant(undefined as undefined),
  fc.constant('' as ''),
)

/**
 * Generates strings that are NOT valid base64-encoded JSON.
 * Covers: random strings, partial base64, valid base64 of non-JSON, etc.
 */
const malformedStateArb: fc.Arbitrary<string> = fc.oneof(
  // Random printable strings (very unlikely to be valid base64 JSON)
  fc.string({ minLength: 1, maxLength: 100 }).filter((s) => {
    try { JSON.parse(atob(s)); return false } catch { return true }
  }),
  // Valid base64 but not JSON (base64 of arbitrary non-JSON strings)
  fc.string({ minLength: 1, maxLength: 50 }).map((s) => btoa(s)).filter((b64) => {
    try { JSON.parse(atob(b64)); return false } catch { return true }
  }),
  // Strings with characters outside base64 alphabet
  fc.constantFrom(
    '!!!not-base64!!!',
    'hello world',
    '{}',
    'null',
    '12345',
    'not.base64.at.all',
    '====',
    'YWJj===invalid',
  ),
)

/**
 * Generates valid base64 JSON but with a missing `team_id` field.
 * The payload is otherwise well-formed (has platform, redirect_uri, user_id).
 */
const missingTeamIdStateArb: fc.Arbitrary<string> = fc.record({
  platform:     fc.constantFrom('instagram', 'twitter', 'facebook', 'linkedin', 'tiktok', 'youtube'),
  redirect_uri: fc.constantFrom('https://app.example.com/social-accounts', 'https://creozel.com/social-accounts'),
  user_id:      fc.uuid(),
  // Deliberately omit team_id
}).map((payload) => btoa(JSON.stringify(payload)))

/**
 * Generates valid base64 JSON with an empty string `team_id`.
 */
const emptyTeamIdStateArb: fc.Arbitrary<string> = fc.record({
  platform:     fc.constantFrom('instagram', 'twitter', 'facebook', 'linkedin', 'tiktok', 'youtube'),
  redirect_uri: fc.constantFrom('https://app.example.com/social-accounts', 'https://creozel.com/social-accounts'),
  user_id:      fc.uuid(),
  team_id:      fc.constant(''),
}).map((payload) => btoa(JSON.stringify(payload)))

/**
 * Generates valid base64 JSON with a whitespace-only `team_id`.
 */
const whitespaceTeamIdStateArb: fc.Arbitrary<string> = fc.record({
  platform:     fc.constantFrom('instagram', 'twitter', 'facebook', 'linkedin', 'tiktok', 'youtube'),
  redirect_uri: fc.constantFrom('https://app.example.com/social-accounts', 'https://creozel.com/social-accounts'),
  user_id:      fc.uuid(),
  team_id:      fc.oneof(
    fc.constant('   '),
    fc.constant('\t'),
    fc.constant('\n'),
    fc.constant('  \t  \n  '),
    // Generate arbitrary whitespace-only strings via regex
    fc.stringMatching(/^[ \t\n\r]+$/).filter((s) => s.length >= 1 && s.length <= 20),
  ),
}).map((payload) => btoa(JSON.stringify(payload)))

/**
 * Generates valid base64 JSON with a null `team_id`.
 */
const nullTeamIdStateArb: fc.Arbitrary<string> = fc.record({
  platform:     fc.constantFrom('instagram', 'twitter', 'facebook', 'linkedin', 'tiktok', 'youtube'),
  redirect_uri: fc.constantFrom('https://app.example.com/social-accounts', 'https://creozel.com/social-accounts'),
  user_id:      fc.uuid(),
  team_id:      fc.constant(null as unknown as string),
}).map((payload) => btoa(JSON.stringify(payload)))

/**
 * Generates a fully valid OAuth state payload (non-empty UUID team_id).
 * Used for complementary "valid state proceeds" properties.
 */
const validStateArb: fc.Arbitrary<string> = fc.record({
  platform:     fc.constantFrom('instagram', 'twitter', 'facebook', 'linkedin', 'tiktok', 'youtube'),
  redirect_uri: fc.constantFrom('https://app.example.com/social-accounts', 'https://creozel.com/social-accounts'),
  user_id:      fc.uuid(),
  team_id:      fc.uuid(),
}).map((payload) => encodeOAuthState(payload as OAuthStatePayload))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 9 — OAuth callback rejects invalid state', () => {

  // ── 9a: Absent state → HTTP 400 + no insert ───────────────────────────────────

  it(
    'absent state (null/undefined/empty): returns HTTP 400 invalid_state and does NOT call Supabase (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * For any absent state value (null, undefined, or empty string), the
       * Edge Function SHALL:
       *   1. Return HTTP 400 with { error: 'invalid_state' }
       *   2. NOT insert any row into social_connections (supabaseCalled = false)
       *
       * This covers the case where the OAuth callback arrives with no `state`
       * query parameter at all.
       */
      fc.assert(
        fc.property(
          absentStateArb,
          (state) => {
            const result = validateOAuthState(state)

            // Property: HTTP 400 is returned
            expect(result.status).toBe(400)

            // Property: error is 'invalid_state'
            expect((result as { error: string }).error).toBe('invalid_state')

            // Property: Supabase is never called
            expect(result.supabaseCalled).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── 9b: Malformed state → HTTP 400 + no insert ───────────────────────────────

  it(
    'malformed state (not valid base64 JSON): returns HTTP 400 invalid_state and does NOT call Supabase (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * For any state string that cannot be decoded as base64 JSON, the Edge
       * Function SHALL:
       *   1. Return HTTP 400 with { error: 'invalid_state' }
       *   2. NOT insert any row into social_connections (supabaseCalled = false)
       *
       * This covers tampered, corrupted, or randomly generated state strings.
       */
      fc.assert(
        fc.property(
          malformedStateArb,
          (state) => {
            const result = validateOAuthState(state)

            // Property: HTTP 400 is returned
            expect(result.status).toBe(400)

            // Property: error is 'invalid_state'
            expect((result as { error: string }).error).toBe('invalid_state')

            // Property: Supabase is never called
            expect(result.supabaseCalled).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── 9c: Missing team_id field → HTTP 400 + no insert ─────────────────────────

  it(
    'valid base64 JSON but missing team_id field: returns HTTP 400 team_id_required and does NOT call Supabase (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * For any state that is valid base64 JSON but lacks a `team_id` field
       * entirely, the Edge Function SHALL:
       *   1. Return HTTP 400 with { error: 'team_id_required' }
       *   2. NOT insert any row into social_connections (supabaseCalled = false)
       *
       * This covers the case where the frontend omits team_id from the state
       * payload (e.g., an older client or a bug in getOAuthUrl).
       */
      fc.assert(
        fc.property(
          missingTeamIdStateArb,
          (state) => {
            const result = validateOAuthState(state)

            // Property: HTTP 400 is returned
            expect(result.status).toBe(400)

            // Property: error is 'team_id_required'
            expect((result as { error: string }).error).toBe('team_id_required')

            // Property: Supabase is never called
            expect(result.supabaseCalled).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── 9d: Empty string team_id → HTTP 400 + no insert ──────────────────────────

  it(
    'valid base64 JSON with empty string team_id: returns HTTP 400 team_id_required and does NOT call Supabase (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * For any state that is valid base64 JSON with `team_id: ""`, the Edge
       * Function SHALL:
       *   1. Return HTTP 400 with { error: 'team_id_required' }
       *   2. NOT insert any row into social_connections (supabaseCalled = false)
       *
       * An empty string team_id is not a valid tenant identifier and must be
       * rejected before any database operation.
       */
      fc.assert(
        fc.property(
          emptyTeamIdStateArb,
          (state) => {
            const result = validateOAuthState(state)

            // Property: HTTP 400 is returned
            expect(result.status).toBe(400)

            // Property: error is 'team_id_required'
            expect((result as { error: string }).error).toBe('team_id_required')

            // Property: Supabase is never called
            expect(result.supabaseCalled).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── 9e: Whitespace-only team_id → HTTP 400 + no insert ───────────────────────

  it(
    'valid base64 JSON with whitespace-only team_id: returns HTTP 400 team_id_required and does NOT call Supabase (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * For any state with a `team_id` that is non-empty but consists only of
       * whitespace characters (spaces, tabs, newlines), the Edge Function SHALL:
       *   1. Return HTTP 400 with { error: 'team_id_required' }
       *   2. NOT insert any row into social_connections (supabaseCalled = false)
       *
       * The Edge Function uses `.trim() === ''` to catch whitespace-only values,
       * preventing a row from being inserted with a meaningless team_id.
       */
      fc.assert(
        fc.property(
          whitespaceTeamIdStateArb,
          (state) => {
            const result = validateOAuthState(state)

            // Property: HTTP 400 is returned
            expect(result.status).toBe(400)

            // Property: error is 'team_id_required'
            expect((result as { error: string }).error).toBe('team_id_required')

            // Property: Supabase is never called
            expect(result.supabaseCalled).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── 9f: Null team_id → HTTP 400 + no insert ──────────────────────────────────

  it(
    'valid base64 JSON with null team_id: returns HTTP 400 team_id_required and does NOT call Supabase (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * For any state with `team_id: null` (JSON null), the Edge Function SHALL:
       *   1. Return HTTP 400 with { error: 'team_id_required' }
       *   2. NOT insert any row into social_connections (supabaseCalled = false)
       *
       * JSON null is falsy in JavaScript, so the `!stateData.team_id` check
       * catches it. This prevents a row with a null team_id from being inserted.
       */
      fc.assert(
        fc.property(
          nullTeamIdStateArb,
          (state) => {
            const result = validateOAuthState(state)

            // Property: HTTP 400 is returned
            expect(result.status).toBe(400)

            // Property: error is 'team_id_required'
            expect((result as { error: string }).error).toBe('team_id_required')

            // Property: Supabase is never called
            expect(result.supabaseCalled).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── 9g: All invalid state categories → supabaseCalled is always false ─────────

  it(
    'for any invalid state category, supabaseCalled is always false (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * The core invariant of Property 9: for ANY invalid state input, the
       * Supabase insert is NEVER called. This property tests all invalid
       * categories together using a union arbitrary.
       *
       * Invalid categories:
       *   - Absent (null/undefined/empty)
       *   - Malformed (not valid base64 JSON)
       *   - Missing team_id field
       *   - Empty string team_id
       *   - Whitespace-only team_id
       *   - Null team_id
       */
      const anyInvalidStateArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
        absentStateArb,
        malformedStateArb,
        missingTeamIdStateArb,
        emptyTeamIdStateArb,
        whitespaceTeamIdStateArb,
        nullTeamIdStateArb,
      )

      fc.assert(
        fc.property(
          anyInvalidStateArb,
          (state) => {
            const result = validateOAuthState(state)

            // Core invariant: invalid state → no Supabase call
            expect(result.supabaseCalled).toBe(false)

            // Core invariant: invalid state → HTTP 400
            expect(result.status).toBe(400)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── 9h: Complementary — valid state proceeds (no false positives) ─────────────

  it(
    'valid state with non-empty UUID team_id: proceeds to insert (supabaseCalled = true) (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * Complementary property: for any valid state with a non-empty UUID
       * team_id, the validation SHALL pass and the Edge Function SHALL proceed
       * to the Supabase insert (supabaseCalled = true).
       *
       * This ensures the validation is not over-broad — it must not reject
       * legitimate OAuth callbacks.
       */
      fc.assert(
        fc.property(
          validStateArb,
          (state) => {
            const result = validateOAuthState(state)

            // Property: valid state proceeds (not rejected)
            expect(result.status).toBe('proceed')
            expect(result.supabaseCalled).toBe(true)

            // Property: the teamId is preserved for the insert
            expect(typeof (result as { teamId: string }).teamId).toBe('string')
            expect((result as { teamId: string }).teamId.length).toBeGreaterThan(0)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── 9i: Rejection is unconditional — other fields don't affect the outcome ────

  it(
    'rejection for invalid team_id is unconditional regardless of platform or user_id (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * The HTTP 400 rejection for an invalid team_id is unconditional: it
       * fires regardless of the platform, redirect_uri, or user_id values in
       * the state. No combination of other valid fields can bypass the
       * team_id validation.
       */
      fc.assert(
        fc.property(
          // Valid base64 JSON with all fields present except a valid team_id
          fc.record({
            platform:     fc.constantFrom('instagram', 'twitter', 'facebook', 'linkedin', 'tiktok', 'youtube'),
            redirect_uri: fc.string({ minLength: 1, maxLength: 200 }),
            user_id:      fc.uuid(),
            // Invalid team_id: empty, whitespace, or null
            team_id: fc.oneof(
              fc.constant(''),
              fc.constant('   '),
              fc.constant(null as unknown as string),
            ),
          }).map((payload) => btoa(JSON.stringify(payload))),
          (state) => {
            const result = validateOAuthState(state)

            // Property: rejection is unconditional
            expect(result.status).toBe(400)
            expect(result.supabaseCalled).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── 9j: Rejection for malformed state is unconditional ───────────────────────

  it(
    'rejection for malformed state is unconditional — no malformed string can bypass decoding (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * For any string that is not valid base64 JSON, the Edge Function SHALL
       * always return HTTP 400 with invalid_state. There is no malformed string
       * that can bypass the decoding step and reach the insert.
       *
       * This property generates a wide variety of non-base64-JSON strings to
       * confirm the catch block always fires.
       */
      fc.assert(
        fc.property(
          // Generate strings that are definitely not valid base64 JSON
          fc.oneof(
            // Strings with spaces (invalid base64)
            fc.string({ minLength: 1, maxLength: 50 }).map((s) => s + ' ' + s),
            // Strings starting with special characters
            fc.string({ minLength: 1, maxLength: 50 }).map((s) => '!' + s),
            // Pure numeric strings (valid base64 but not JSON objects)
            fc.integer({ min: 0, max: 999999 }).map(String),
            // Strings with URL-unsafe characters
            fc.constantFrom('a=b', 'x+y', 'foo/bar', '<script>', '{"no":"close"'),
          ).filter((s) => {
            try { JSON.parse(atob(s)); return false } catch { return true }
          }),
          (state) => {
            const result = validateOAuthState(state)

            expect(result.status).toBe(400)
            expect((result as { error: string }).error).toBe('invalid_state')
            expect(result.supabaseCalled).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

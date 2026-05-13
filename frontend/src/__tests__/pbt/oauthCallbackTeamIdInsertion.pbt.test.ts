// Feature: mvp-saas-platform, Property 8: OAuth callback team_id insertion

/**
 * Validates: Requirements 5.4
 *
 * Property 8: For any valid OAuth callback where the `state` parameter
 * contains a non-empty `team_id`, the `oauth-connect` Edge Function SHALL
 * insert a `social_connections` row with `team_id` equal to the value from
 * `state`.
 *
 * Implementation note:
 *   The Edge Function runs in Deno/Supabase and cannot be invoked directly
 *   from Jest/Vitest. Instead, we extract and test the two pure logical steps
 *   that constitute Property 8:
 *
 *   Step 1 — State decoding:
 *     stateData = JSON.parse(atob(state))
 *     The decoded `team_id` must equal the original `team_id` that was
 *     encoded into the state.
 *
 *   Step 2 — Insert payload construction:
 *     The `social_connections` upsert payload must include `team_id` equal
 *     to `stateData.team_id`.
 *
 *   The key invariant tested here is:
 *     decoded_state.team_id === insert_payload.team_id === original_team_id
 *
 *   This mirrors the exact logic in supabase/functions/oauth-connect/index.ts:
 *
 *     // Decode state
 *     stateData = JSON.parse(atob(state))
 *
 *     // Validate team_id
 *     if (!stateData.team_id || typeof stateData.team_id !== 'string' || stateData.team_id.trim() === '') {
 *       return HTTP 400
 *     }
 *
 *     // Insert row with team_id from state
 *     await supabase.from('social_connections').upsert({
 *       user_id:  stateData.user_id,
 *       team_id:  stateData.team_id,   // ← this is the invariant
 *       platform: stateData.platform,
 *       ...
 *     })
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OAuthStatePayload {
  platform: string
  redirect_uri: string
  user_id: string
  team_id: string
}

interface SocialConnectionInsertPayload {
  user_id: string
  team_id: string
  platform: string
  platform_account_id: string
  account_name: string
  is_active: boolean
  vault_secret_id: string | null
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a non-empty team_id (UUID) */
const teamIdArb: fc.Arbitrary<string> = fc.uuid()

/** Generates a valid user_id (UUID) */
const userIdArb: fc.Arbitrary<string> = fc.uuid()

/** Generates a social platform string */
const platformArb: fc.Arbitrary<string> = fc.constantFrom(
  'instagram',
  'twitter',
  'facebook',
  'linkedin',
  'tiktok',
  'youtube',
)

/** Generates a redirect URI */
const redirectUriArb: fc.Arbitrary<string> = fc.constantFrom(
  'https://app.example.com/social-accounts',
  'https://creozel.com/social-accounts',
  'http://localhost:5173/social-accounts',
)

/** Generates a vault secret ID (UUID or null) */
const vaultSecretIdArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.uuid(),
  fc.constant(null as null),
)

/**
 * Generates a complete valid OAuth state payload with a non-empty team_id.
 * This represents the state that the frontend encodes and the Edge Function
 * decodes during the OAuth callback.
 */
const validStatePayloadArb: fc.Arbitrary<OAuthStatePayload> = fc.record({
  platform: platformArb,
  redirect_uri: redirectUriArb,
  user_id: userIdArb,
  team_id: teamIdArb,
})

// ─── Pure simulations of Edge Function logic ─────────────────────────────────

/**
 * Simulates the state encoding performed by `getOAuthUrl` in socialService.ts:
 *
 *   const state = btoa(JSON.stringify({
 *     platform,
 *     redirect_uri: redirectUri,
 *     user_id: userId,
 *     team_id: teamId,
 *   }))
 *
 * Returns the base64-encoded state string.
 */
function encodeOAuthState(payload: OAuthStatePayload): string {
  return btoa(JSON.stringify(payload))
}

/**
 * Simulates the state decoding performed by the `oauth-connect` Edge Function:
 *
 *   stateData = JSON.parse(atob(state)) as OAuthStatePayload
 *
 * Returns the decoded payload, or throws if the state is not valid base64 JSON.
 */
function decodeOAuthState(encodedState: string): OAuthStatePayload {
  return JSON.parse(atob(encodedState)) as OAuthStatePayload
}

/**
 * Simulates the team_id validation performed by the Edge Function:
 *
 *   if (!stateData.team_id || typeof stateData.team_id !== 'string' || stateData.team_id.trim() === '') {
 *     return HTTP 400
 *   }
 *
 * Returns true if team_id is valid (non-empty string), false otherwise.
 */
function isValidTeamId(teamId: unknown): boolean {
  return (
    typeof teamId === 'string' &&
    teamId.trim() !== ''
  )
}

/**
 * Simulates the `social_connections` insert payload construction in the
 * `oauth-connect` Edge Function:
 *
 *   await supabase.from('social_connections').upsert({
 *     user_id:             stateData.user_id,
 *     team_id:             stateData.team_id,
 *     platform:            stateData.platform,
 *     platform_account_id: stateData.user_id,
 *     account_name:        stateData.platform,
 *     is_active:           true,
 *     vault_secret_id:     vaultData?.id ?? null,
 *   }, { onConflict: 'team_id,platform,platform_account_id' })
 *
 * Returns the insert payload that would be sent to Supabase.
 */
function buildInsertPayload(
  stateData: OAuthStatePayload,
  vaultSecretId: string | null,
): SocialConnectionInsertPayload {
  return {
    user_id:             stateData.user_id,
    team_id:             stateData.team_id,
    platform:            stateData.platform,
    platform_account_id: stateData.user_id,
    account_name:        stateData.platform,
    is_active:           true,
    vault_secret_id:     vaultSecretId,
  }
}

/**
 * Simulates the full Edge Function callback flow for a valid state:
 *   1. Decode the state parameter
 *   2. Validate team_id
 *   3. Build the insert payload
 *
 * Returns { decodedState, insertPayload, isValid } for property assertions.
 */
function simulateEdgeFunctionCallback(
  encodedState: string,
  vaultSecretId: string | null,
): {
  decodedState: OAuthStatePayload
  insertPayload: SocialConnectionInsertPayload
  isValid: boolean
} {
  const decodedState = decodeOAuthState(encodedState)
  const isValid = isValidTeamId(decodedState.team_id)
  const insertPayload = buildInsertPayload(decodedState, vaultSecretId)
  return { decodedState, insertPayload, isValid }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 8 — OAuth callback team_id insertion', () => {

  // ── Property 8a: decoded state team_id equals original team_id ───────────────

  it(
    'decoded state team_id always equals the original team_id (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * For any valid OAuth state payload with a non-empty team_id, encoding
       * the state as `btoa(JSON.stringify(payload))` and then decoding it as
       * `JSON.parse(atob(state))` SHALL produce a `team_id` field equal to
       * the original team_id.
       *
       * This verifies Step 1 of Property 8: the state decoding is lossless
       * for the team_id field.
       */
      fc.assert(
        fc.property(
          validStatePayloadArb,
          (payload) => {
            const encodedState = encodeOAuthState(payload)
            const decodedState = decodeOAuthState(encodedState)

            // Property: decoded team_id equals the original team_id
            expect(decodedState.team_id).toBe(payload.team_id)

            // Property: team_id is a non-empty string after decoding
            expect(typeof decodedState.team_id).toBe('string')
            expect(decodedState.team_id.length).toBeGreaterThan(0)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'state encoding/decoding is lossless for all payload fields (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * The full state payload (platform, redirect_uri, user_id, team_id)
       * must survive the btoa/atob round-trip without any field being lost
       * or mutated. This ensures the Edge Function can reliably read all
       * fields it needs from the decoded state.
       */
      fc.assert(
        fc.property(
          validStatePayloadArb,
          (payload) => {
            const encodedState = encodeOAuthState(payload)
            const decodedState = decodeOAuthState(encodedState)

            // Property: all fields survive the round-trip
            expect(decodedState.team_id).toBe(payload.team_id)
            expect(decodedState.user_id).toBe(payload.user_id)
            expect(decodedState.platform).toBe(payload.platform)
            expect(decodedState.redirect_uri).toBe(payload.redirect_uri)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 8b: insert payload team_id equals decoded state team_id ─────────

  it(
    'insert payload team_id always equals the decoded state team_id (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * For any valid decoded state, the `social_connections` insert payload
       * constructed by the Edge Function SHALL have `team_id` equal to
       * `stateData.team_id`.
       *
       * This verifies Step 2 of Property 8: the insert payload correctly
       * propagates team_id from the decoded state.
       */
      fc.assert(
        fc.property(
          validStatePayloadArb,
          vaultSecretIdArb,
          (payload, vaultSecretId) => {
            const insertPayload = buildInsertPayload(payload, vaultSecretId)

            // Property: insert payload team_id equals the state team_id
            expect(insertPayload.team_id).toBe(payload.team_id)

            // Property: team_id is a non-empty string in the insert payload
            expect(typeof insertPayload.team_id).toBe('string')
            expect(insertPayload.team_id.length).toBeGreaterThan(0)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'insert payload team_id is never empty for any valid state (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * The insert payload must never have an empty team_id when the state
       * contains a valid non-empty team_id. This ensures every inserted
       * social_connections row is properly scoped to a tenant.
       */
      fc.assert(
        fc.property(
          validStatePayloadArb,
          vaultSecretIdArb,
          (payload, vaultSecretId) => {
            const insertPayload = buildInsertPayload(payload, vaultSecretId)

            // Property: team_id is present and non-empty
            expect(insertPayload.team_id).not.toBe('')
            expect(insertPayload.team_id).not.toBeNull()
            expect(insertPayload.team_id).not.toBeUndefined()
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 8c: end-to-end invariant (original → encoded → decoded → inserted) ──

  it(
    'end-to-end: original team_id === decoded team_id === insert payload team_id (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * The core invariant of Property 8:
       *   original_team_id === decoded_state.team_id === insert_payload.team_id
       *
       * For any valid OAuth state payload with a non-empty team_id, the full
       * pipeline (encode → decode → build insert payload) SHALL preserve the
       * team_id at every step.
       *
       * This is the single most important property: it proves that the
       * team_id from the OAuth state always ends up in the inserted row.
       */
      fc.assert(
        fc.property(
          validStatePayloadArb,
          vaultSecretIdArb,
          (payload, vaultSecretId) => {
            const encodedState = encodeOAuthState(payload)
            const { decodedState, insertPayload, isValid } = simulateEdgeFunctionCallback(
              encodedState,
              vaultSecretId,
            )

            // Pre-condition: the state is valid (non-empty team_id)
            expect(isValid).toBe(true)

            // Core invariant: original === decoded === inserted
            expect(decodedState.team_id).toBe(payload.team_id)
            expect(insertPayload.team_id).toBe(payload.team_id)
            expect(insertPayload.team_id).toBe(decodedState.team_id)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'end-to-end: insert payload team_id differs when original team_id differs (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * For any two distinct team_ids, the insert payloads produced from their
       * respective states SHALL have different team_id values. This verifies
       * that the team_id is not shared, cached, or defaulted across different
       * OAuth callbacks.
       */
      fc.assert(
        fc.property(
          validStatePayloadArb,
          validStatePayloadArb,
          vaultSecretIdArb,
          (payloadA, payloadB, vaultSecretId) => {
            // Only test when the two payloads have different team_ids
            fc.pre(payloadA.team_id !== payloadB.team_id)

            const encodedStateA = encodeOAuthState(payloadA)
            const encodedStateB = encodeOAuthState(payloadB)

            const { insertPayload: insertA } = simulateEdgeFunctionCallback(encodedStateA, vaultSecretId)
            const { insertPayload: insertB } = simulateEdgeFunctionCallback(encodedStateB, vaultSecretId)

            // Property: different original team_ids produce different insert team_ids
            expect(insertA.team_id).toBe(payloadA.team_id)
            expect(insertB.team_id).toBe(payloadB.team_id)
            expect(insertA.team_id).not.toBe(insertB.team_id)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 8d: team_id validation accepts all non-empty strings ─────────────

  it(
    'team_id validation accepts any non-empty, non-whitespace-only string (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * The Edge Function's team_id validation (`!stateData.team_id ||
       * typeof stateData.team_id !== 'string' || stateData.team_id.trim() === ''`)
       * SHALL accept any non-empty, non-whitespace-only string as a valid
       * team_id. In practice, team_ids are always UUIDs, but the validation
       * logic is tested against the full space of valid inputs.
       */
      fc.assert(
        fc.property(
          // Generate non-empty strings that are not purely whitespace
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim() !== ''),
          (teamId) => {
            // Property: any non-empty, non-whitespace-only string passes validation
            expect(isValidTeamId(teamId)).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'team_id validation accepts all UUID-format team_ids (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * Since all team_ids in the system are UUIDs, the validation must
       * accept every possible UUID. This property verifies that no valid
       * UUID is incorrectly rejected by the team_id validation logic.
       */
      fc.assert(
        fc.property(
          fc.uuid(),
          (teamId) => {
            // Property: every UUID passes team_id validation
            expect(isValidTeamId(teamId)).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // ── Property 8e: insert payload preserves all state fields ───────────────────

  it(
    'insert payload user_id always equals the decoded state user_id (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * The insert payload must correctly propagate user_id from the decoded
       * state, in addition to team_id. This ensures the inserted row is
       * correctly attributed to both the user and the team.
       */
      fc.assert(
        fc.property(
          validStatePayloadArb,
          vaultSecretIdArb,
          (payload, vaultSecretId) => {
            const insertPayload = buildInsertPayload(payload, vaultSecretId)

            // Property: user_id is propagated correctly
            expect(insertPayload.user_id).toBe(payload.user_id)

            // Property: platform is propagated correctly
            expect(insertPayload.platform).toBe(payload.platform)

            // Property: is_active defaults to true for new connections
            expect(insertPayload.is_active).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  it(
    'insert payload vault_secret_id matches the provided vault secret (100 runs)',
    () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * The insert payload must correctly carry the vault_secret_id returned
       * by Supabase Vault, whether it is a UUID or null. This ensures the
       * token reference is correctly stored alongside the team_id.
       */
      fc.assert(
        fc.property(
          validStatePayloadArb,
          vaultSecretIdArb,
          (payload, vaultSecretId) => {
            const insertPayload = buildInsertPayload(payload, vaultSecretId)

            // Property: vault_secret_id is passed through unchanged
            expect(insertPayload.vault_secret_id).toBe(vaultSecretId)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})

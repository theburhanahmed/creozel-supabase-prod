# Requirements — mvp-social-accounts

## Introduction

The Social Accounts page (`SocialAccounts.tsx`) allows users to connect and disconnect OAuth-linked social platform accounts. The UI is fully implemented. The remaining gaps are: creating the `oauth-connect` Supabase Edge Function that handles the OAuth redirect flow, verifying the disconnect flow marks tokens as inactive in Supabase Vault, and ensuring TypeScript strict mode compliance.

## Glossary

- **SocialAccounts**: The React page at `frontend/src/pages/SocialAccounts.tsx`
- **socialService**: The service module at `frontend/src/services/socialService.ts`
- **oauth-connect**: The Supabase Edge Function that initiates and handles OAuth2 redirects for social platforms
- **SocialConnection**: A row in the `social_connections` table representing a connected platform account
- **Supabase Vault**: Encrypted secret storage used to hold OAuth tokens

## Requirements

### Requirement 1 — OAuth Connect Edge Function

**User Story:** As a user, I want clicking "Connect" to redirect me to the platform's OAuth authorization page, so that I can grant Creozel permission to publish on my behalf.

#### Acceptance Criteria

1. THE `oauth-connect` Edge Function SHALL accept a `platform` query parameter and a `redirect_uri` query parameter.
2. WHEN the Edge Function receives a valid `platform` value, THE Edge Function SHALL redirect the user to the platform's OAuth authorization URL with the appropriate `client_id`, `scope`, and `state` parameters.
3. WHEN the OAuth provider redirects back with an authorization code, THE Edge Function SHALL exchange the code for access and refresh tokens, store them in Supabase Vault, and insert a row into `social_connections` with `is_active = true`.
4. AFTER successful token storage, THE Edge Function SHALL redirect the user to the `redirect_uri` (the `/social-accounts` page).
5. IF the OAuth exchange fails, THE Edge Function SHALL redirect to `redirect_uri` with an `error` query parameter containing a human-readable message.

### Requirement 2 — Disconnect Flow

**User Story:** As a user, I want disconnecting an account to revoke the stored token and cancel any scheduled posts for that account.

#### Acceptance Criteria

1. WHEN `disconnectSocialAccount` is called, THE `socialService` SHALL update the `social_connections` row to `is_active = false` via PostgREST PATCH.
2. WHEN a connection is disconnected, THE system SHALL cancel any `scheduled_posts` rows linked to that `social_connection_id` by updating their `status` to `'failed'` with `error_message = 'Social account disconnected'`.
3. THE disconnect operation SHALL use `catch (error: unknown)` with `reportError` in all error paths.

### Requirement 3 — TypeScript Strict Mode

**User Story:** As a developer, I want `SocialAccounts.tsx` and `socialService.ts` to pass `npx tsc --noEmit` with strict mode.

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed, THE TypeScript compiler SHALL exit with code 0 with no errors in `SocialAccounts.tsx` or `socialService.ts`.
2. ALL `catch` blocks SHALL use `catch (error: unknown)` — no `catch (error: any)`.

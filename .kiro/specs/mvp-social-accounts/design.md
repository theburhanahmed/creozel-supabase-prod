# Design — mvp-social-accounts

## Overview

The Social Accounts page is fully implemented. The remaining work is creating the `oauth-connect` Supabase Edge Function, updating the disconnect flow to also cancel scheduled posts, and verifying TypeScript compliance.

## Architecture

```
SocialAccounts.tsx
  ├── getSocialConnections(userId)  → supabase.from('social_connections')
  ├── handleConnect(platform)       → window.location.href = getOAuthUrl(platform)
  │                                    → /functions/v1/oauth-connect?platform=X
  │                                    → Platform OAuth → callback → Edge Function
  │                                    → stores token in Vault, inserts social_connections row
  │                                    → redirects to /social-accounts
  └── handleDisconnect(connection)  → disconnectSocialAccount(id)
                                       → PATCH social_connections.is_active = false
                                       → PATCH scheduled_posts.status = 'failed' for that connection
```

## Components

### `oauth-connect` Edge Function (`supabase/functions/oauth-connect/index.ts`)

Handles two phases:
1. **Initiation** (`GET ?platform=X&redirect_uri=Y`): Builds the platform OAuth URL and redirects.
2. **Callback** (`GET ?code=X&state=Y`): Exchanges code for tokens, stores in Vault, inserts `social_connections` row.

Platform OAuth URLs:
- Instagram: `https://api.instagram.com/oauth/authorize`
- YouTube/Google: `https://accounts.google.com/o/oauth2/v2/auth`
- Twitter/X: `https://twitter.com/i/oauth2/authorize`
- Facebook: `https://www.facebook.com/v18.0/dialog/oauth`
- LinkedIn: `https://www.linkedin.com/oauth/v2/authorization`
- TikTok: `https://www.tiktok.com/auth/authorize/`

### `disconnectSocialAccount` update (`socialService.ts`)

After marking `is_active = false`, issue a second PATCH to cancel scheduled posts:

```typescript
await supabase
  .from('scheduled_posts')
  .update({ status: 'failed', error_message: 'Social account disconnected' })
  .eq('social_connection_id', connectionId)
  .eq('status', 'scheduled')
```

## Correctness Properties

- **OAuth callback stores token**: For any successful OAuth exchange, a `social_connections` row with `is_active = true` and a valid `vault_secret_id` must exist.
- **Disconnect cancels posts**: For any disconnected connection, all `scheduled_posts` with that `social_connection_id` and `status = 'scheduled'` must be updated to `status = 'failed'`.

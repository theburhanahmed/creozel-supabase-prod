# Tasks — mvp-social-accounts

- [ ] 1. Create `oauth-connect` Supabase Edge Function
  - Create `supabase/functions/oauth-connect/index.ts`
  - Handle initiation phase: build platform OAuth URL and redirect
  - Handle callback phase: exchange code for tokens, store in Supabase Vault, insert `social_connections` row
  - On success: redirect to `redirect_uri`
  - On failure: redirect to `redirect_uri?error=<message>`
  - **Validates:** Requirements 1.1–1.5

- [ ] 2. Update `disconnectSocialAccount` to cancel scheduled posts
  - After PATCH `is_active = false`, issue a second PATCH to `scheduled_posts`
  - Set `status = 'failed'` and `error_message = 'Social account disconnected'` for all scheduled posts linked to the disconnected connection
  - Use `catch (error: unknown)` with `reportError`
  - **Validates:** Requirements 2.1–2.3

- [ ] 3. Verify TypeScript strict mode compliance
  - Run `npx tsc --noEmit` from `frontend/`
  - Fix any errors in `SocialAccounts.tsx` and `socialService.ts`
  - Confirm all `catch` blocks use `catch (error: unknown)`
  - **Validates:** Requirements 3.1–3.2

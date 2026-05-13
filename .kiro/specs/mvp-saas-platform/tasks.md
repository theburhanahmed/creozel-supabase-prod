# Implementation Tasks — MVP SaaS Platform

## Task Overview

This file tracks all implementation tasks for the `mvp-saas-platform` spec. Tasks are ordered by dependency: database/RLS first, then context layer, then components, then services, then pages, then Edge Functions, then tests.

---

## Task 1 — Database: RLS Policies and Wallets Trigger

Apply Supabase migrations to enforce tenant isolation at the database layer.

**Requirements:** 1.6, 1.7, 1.12, 4.3, 4.8, 5.3, 5.8
**Design:** Data Models → RLS Policies

### Sub-tasks

- [x] 1.1 — Write and apply migration `add_tenant_rls_policies`: add SELECT, INSERT, UPDATE, DELETE RLS policies on `media_items`, `social_connections`, `content_jobs`, `scheduled_posts`, `pipeline_executions`, `analytics_events` using the `team_members` membership check pattern from the design document
- [x] 1.2 — Write and apply migration `add_storage_tenant_rls`: add SELECT, INSERT, UPDATE, DELETE policies on `storage.objects` for the `media` bucket, restricting access to files under a `team_id` prefix to members of that team
- [x] 1.3 — Write and apply migration `add_wallets_trigger`: create a PostgreSQL trigger on the `teams` table that automatically inserts a `wallets` row with `balance = 0` and `reserved = 0` whenever a new team is created
- [x] 1.4 — Verify the UNIQUE constraint `(team_id, platform, platform_account_id)` exists on `social_connections`; add it via migration if missing

---

## Task 2 — AppContext: Multi-Tenant State and Team Resolution

Extend `AppContext` with `activeTeam`, `teams`, `isTeamLoading`, and `setActiveTeam`. Implement the full mount sequence and team-switch logic.

**Requirements:** 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3
**Design:** Components and Interfaces → AppContext Changes; Data Models → AppContext State; Error Handling → AppContext

### Sub-tasks

- [x] 2.1 — Add `activeTeam: Team | null`, `teams: Team[]`, `isTeamLoading: boolean`, and `setActiveTeam: (team: Team | null) => void` to the `AppContextType` interface in `AppContext.tsx`; type `activeTeam` as `Team | null` in the interface declaration, state initialisation, and provider value object — no `any` types
- [x] 2.2 — Implement the mount sequence: after resolving the authenticated user, query `team_members` joined with `teams` for the user's `user_id`; wrap the `localStorage.getItem('creozel:activeTeamId')` call in try/catch for `SecurityError`; if the stored ID matches a team in the resolved list set `activeTeam` to that team, otherwise apply role-priority selection (`owner=4 > admin=3 > editor=2 > viewer=1`, earliest `created_at` tiebreaker); if no teams exist set `activeTeam` to `null`
- [x] 2.3 — Implement `setActiveTeam`: clear all tenant-scoped state slices (social connections, media items, content jobs, scheduled posts, analytics) before re-fetching; write the new `team.id` to `localStorage['creozel:activeTeamId']` (or remove the key if `team` is `null`); wrap localStorage writes in try/catch for `SecurityError`
- [x] 2.4 — Implement the 10-second stale-data timeout: after a team switch, if re-fetch does not complete within 10 seconds, set an `isStaleDataError` flag and clear any partially loaded data so no previous tenant's data is visible
- [x] 2.5 — On logout, call `localStorage.removeItem('creozel:activeTeamId')` wrapped in try/catch
- [x] 2.6 — Ensure `useAppContext` throws a descriptive error when called outside an `AppProvider` tree
- [x] 2.7 — Add `catch (error: unknown)` blocks calling `reportError('fetchTeamData [AppContext.tsx]', error)` to all new async operations

---

## Task 3 — TenantSwitcher Component

Create the new `TenantSwitcher` component and integrate it into the `MainNavigation` sidebar user card area.

**Requirements:** 1.3, 1.11, 9.5
**Design:** Components and Interfaces → TenantSwitcher Component

### Sub-tasks

- [x] 3.1 — Create `frontend/src/components/layout/TenantSwitcher.tsx` with explicit props `teams: Team[]`, `activeTeam: Team | null`, `onSwitch: (team: Team) => void`; use only icons already imported in `MainNavigation` (`ChevronDownIcon`, `UsersIcon`)
- [x] 3.2 — When `activeTeam` is non-null, render the team name and avatar in place of the personal user display; when `activeTeam` is null, render the personal user display
- [x] 3.3 — Render a dropdown list of all teams when the switcher is clicked; clicking a team calls `onSwitch(team)` — no `window.location` change or URL navigation
- [x] 3.4 — Integrate `TenantSwitcher` into `MainNavigation.tsx` sidebar user card section, passing `teams` and `activeTeam` from `useAppContext()` and `onSwitch` delegating to `setActiveTeam`

---

## Task 4 — MainNavigation Restructure

Promote Social Accounts and Media Library to top-level leaf nodes; fix Publishing and Autopilot children.

**Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
**Design:** Components and Interfaces → MainNavigation Restructure

### Sub-tasks

- [x] 4.1 — Restructure the `navItems` array in `MainNavigation.tsx` to the exact top-level order: Home (`/`), Create (`/content`), Autopilot (`/autopilot`), Analytics (`/analytics`), Publishing (`/calendar`), Social Accounts (`/social-accounts`), Media Library (`/media`), Communication (`/messages`), Workflows (`/workflow`)
- [x] 4.2 — Add Social Accounts as a leaf node (`title: 'Social Accounts'`, `href: '/social-accounts'`, `icon: GlobeIcon`) with no `children` array
- [x] 4.3 — Add Media Library as a leaf node (`title: 'Media Library'`, `href: '/media'`, `icon: FolderIcon`) with no `children` array
- [x] 4.4 — Remove Social Accounts and Media Gallery child items from the Publishing group; Publishing children must contain only Calendar (`/calendar`)
- [x] 4.5 — Remove the Media Library child item from the Autopilot group; Autopilot children must contain only Dashboard (`/autopilot`), Create Pipeline (`/autopilot/create`), Scheduler (`/autopilot/scheduler`)
- [x] 4.6 — Do not add any new icon imports; confirm `GlobeIcon` and `FolderIcon` are already imported
- [x] 4.7 — Run `npx tsc --noEmit` from `frontend/` and confirm exit code 0 with zero errors

---

## Task 5 — mediaService: Tenant Scoping and Null Guard

Update `mediaService` to require `teamId` on every call, enforce the storage path format, and return safe defaults on error.

**Requirements:** 4.1, 4.2, 4.4, 4.7, 4.9, 9.1, 9.6
**Design:** Components and Interfaces → MediaGallery Page Changes; Data Models → Storage Path Format; Error Handling → mediaService

### Sub-tasks

- [x] 5.1 — Update `getMediaItems(userId, teamId)` to filter by `team_id = teamId` when `teamId` is non-null, or `team_id IS NULL` when `teamId` is null; return `[]` on any error; add `catch (error: unknown)` calling `reportError('getMediaItems [mediaService.ts]', error)`
- [x] 5.2 — Update `uploadMediaItem`: add null guard — if `teamId` is null/undefined, call `reportError` and return `null` without touching Supabase; set `team_id` to `teamId` on every inserted `media_items` row; use storage path `{teamId}/{userId}/{Date.now()}_{filename}`; return `null` on any error
- [x] 5.3 — Update `deleteMediaItem`: add null guard — if `teamId` is null/undefined, call `reportError` and return `false`; filter delete by both `id` and `team_id`; return `false` on any error
- [x] 5.4 — Add `catch (error: unknown)` blocks calling `reportError('mediaService.<functionName> [mediaService.ts]', error)` to all functions

---

## Task 6 — socialService: Tenant Scoping and OAuth State

Update `socialService` to require `teamId` on every call and embed `team_id` in the OAuth state parameter.

**Requirements:** 5.1, 5.2, 5.4, 5.6, 9.1, 9.6
**Design:** Components and Interfaces → SocialAccounts Page Changes; Data Models → OAuth State Payload; Error Handling → socialService

### Sub-tasks

- [x] 6.1 — Update `getSocialConnections(teamId)`: if `teamId` is null, return `[]` immediately without calling Supabase; otherwise filter by `team_id = teamId`; return `[]` on any error; add `catch (error: unknown)` calling `reportError('getSocialConnections [socialService.ts]', error)`
- [x] 6.2 — Update `disconnectSocialAccount(connectionId, teamId)`: filter delete by both `id` and `team_id`; return `false` on any error; add `catch (error: unknown)` calling `reportError('disconnectSocialAccount [socialService.ts]', error)`
- [x] 6.3 — Update `getOAuthUrl(platform, teamId)`: embed `team_id` in the `state` parameter as `btoa(JSON.stringify({ platform, redirect_uri, user_id, team_id: teamId }))`; this is a pure function — validate that `teamId` is non-empty before calling

---

## Task 7 — MediaGallery Page: Tenant Context Integration

Wire `MediaGallery` to `activeTeam` from context, show team name in header, and clear-and-refetch on team switch.

**Requirements:** 4.1, 4.2, 4.5, 4.6
**Design:** Components and Interfaces → MediaGallery Page Changes

### Sub-tasks

- [x] 7.1 — Read `activeTeam` and `teams` from `useAppContext()` in `MediaGallery`; pass `activeTeam?.id ?? null` as `teamId` to all `mediaService` calls
- [x] 7.2 — Display the active team name in the `MediaGallery` page header (e.g., "Acme Corp — Media Library"); when `activeTeam` is null, show "Personal — Media Library"
- [x] 7.3 — Add a `useEffect` on `activeTeam` change: clear the `items` state and show a loading skeleton before re-fetching assets scoped to the new `activeTeam.id`

---

## Task 8 — SocialAccounts Page: Tenant Context Integration

Wire `SocialAccounts` to `activeTeam` from context, show null-team empty state, show team name in header, and clear-and-refetch on team switch.

**Requirements:** 5.1, 5.2, 5.6, 5.7
**Design:** Components and Interfaces → SocialAccounts Page Changes

### Sub-tasks

- [x] 8.1 — Read `activeTeam` from `useAppContext()` in `SocialAccounts`; when `activeTeam` is null, render an empty state with the message "A team is required to manage social accounts" and a CTA button to create or join a team; do not render the connections list
- [x] 8.2 — When `activeTeam` is non-null, pass `activeTeam.id` to all `socialService` calls; embed `activeTeam.id` in the OAuth state via `getOAuthUrl`
- [x] 8.3 — Display the active team name in the `SocialAccounts` page header (e.g., "Acme Corp — Social Accounts")
- [x] 8.4 — Add a `useEffect` on `activeTeam` change: clear the `connections` state and re-fetch connections scoped to the new `activeTeam.id`

---

## Task 9 — Settings Page: Integrations Tab Cleanup

Update the Settings integrations tab to show a read-only summary and a "Manage Connections" link; remove any full social account management UI.

**Requirements:** 2.6, 2.8
**Design:** Components and Interfaces → MainNavigation Restructure (note on Settings)

### Sub-tasks

- [x] 9.1 — In the Settings integrations tab, retain a read-only connection status summary showing each connected platform and its connection state
- [x] 9.2 — Add a "Manage Connections" link/button that navigates to `/social-accounts`
- [x] 9.3 — Remove any connect/disconnect buttons or full social account management UI from the Settings integrations tab

---

## Task 10 — oauth-connect Edge Function: team_id Validation

Update the `oauth-connect` Edge Function to read and validate `team_id` from the OAuth state parameter.

**Requirements:** 5.4, 5.5
**Design:** Data Models → OAuth State Payload; Error Handling → oauth-connect Edge Function

### Sub-tasks

- [x] 10.1 — In the `oauth-connect` Edge Function callback handler, decode the `state` parameter (`atob` + `JSON.parse`) and extract `team_id`
- [x] 10.2 — If `state` is absent, malformed (not valid base64 JSON), or `team_id` is absent or empty, return HTTP 400 with `{ error: 'team_id_required' }` and do NOT insert any row into `social_connections`
- [x] 10.3 — When `team_id` is valid, set `team_id` on the inserted `social_connections` row

---

## Task 11 — ContentHub: Advanced Options Interfaces and Types

Define the four typed advanced options interfaces and add them to the project's type system.

**Requirements:** 6.1, 6.2, 6.3, 6.4, 9.4
**Design:** Components and Interfaces → ContentHub Advanced Options

### Sub-tasks

- [x] 11.1 — Create `TextAdvancedOptions`, `ImageAdvancedOptions`, `VideoAdvancedOptions`, and `AudioAdvancedOptions` interfaces in `frontend/src/types/index.ts` (or a co-located types file); each interface must declare at least one named field specific to that content type; no `Record<string, unknown>` or `any` types
- [x] 11.2 — Add default values for each interface (e.g., `DEFAULT_TEXT_OPTIONS`, `DEFAULT_IMAGE_OPTIONS`, etc.) as exported constants

---

## Task 12 — ContentHub: Advanced Options UI Panels

Add collapsible advanced options panels to each content type tab in `ContentHub`.

**Requirements:** 6.1, 6.2, 6.3, 6.4, 6.6, 6.9, 6.10
**Design:** Components and Interfaces → ContentHub Advanced Options

### Sub-tasks

- [ ] 12.1 — Add a collapsible "Advanced options" section to the text generation panel with: AI model selector (GPT-4, GPT-3.5), tone selector, output format selector, word count min/max inputs (1–10,000, max ≥ min), language selector, brand voice toggle; default to collapsed
- [x] 12.2 — Add a collapsible "Advanced options" section to the image generation panel with: AI provider selector (DALL-E 3, Stable Diffusion), resolution selector, style selector, negative prompt input (max 500 chars), number of images selector (1–4), seed input (0–2,147,483,647); default to collapsed
- [x] 12.3 — Add a collapsible "Advanced options" section to the video generation panel with: AI model selector, scene count selector (1–10), duration per scene selector (15s/30s/60s), aspect ratio selector (16:9/9:16/1:1), B-roll toggle, brand voice toggle; default to collapsed
- [x] 12.4 — Add a collapsible "Advanced options" section to the audio generation panel with: TTS provider selector (ElevenLabs/Whisper), voice selector (dynamic from provider), speaking rate slider (0.5–2.0), pitch adjustment slider (−10 to +10), output format selector (MP3/WAV), stability/clarity slider (0–100, ElevenLabs only); if voice list fetch fails, show "Failed to load voices" and disable selector with a retry button; default to collapsed
- [x] 12.5 — On `ContentHub` mount, fetch the active team's `brand_profiles` row; if `voice_guidelines` is non-null, set `brandVoiceEnabled` to `true`; if fetch fails, default to `false`
- [x] 12.6 — Persist advanced options to `localStorage` under `{team_id}:{content_type}:advancedOptions` on every change; on mount, restore from `localStorage`; if `localStorage` is unavailable or value is corrupt, silently use defaults

---

## Task 13 — ContentHub: Credit Cost Estimate

Wire the credit cost estimate display to `pricing_config` and handle the unreachable case.

**Requirements:** 6.5, 6.11
**Design:** Components and Interfaces → ContentHub Advanced Options → Credit cost estimate; Error Handling → ContentHub

### Sub-tasks

- [x] 13.1 — On `ContentHub` mount and whenever advanced options change, call `getPricingConfig()` from `contentService` and compute the estimated credit cost based on the selected model/provider
- [x] 13.2 — Display the computed cost estimate to the user before generation begins
- [x] 13.3 — If `getPricingConfig()` returns `[]` (unreachable), render "Cost estimate unavailable" in the cost display area and hide any numeric figure; do not show a stale or zero cost

---

## Task 14 — ContentHub: Job Submission with Advanced Options Metadata

Include all advanced option values in the `content_jobs` metadata on job submission.

**Requirements:** 6.7
**Design:** Data Models → content_jobs metadata

### Sub-tasks

- [x] 14.1 — When a generation job is submitted, spread all selected advanced option fields into the `metadata` field of the `content_jobs` row (e.g., `model`, `tone`, `output_format`, `word_count_min`, `word_count_max`, `language`, `brand_voice` for text; `provider`, `resolution`, `style`, `negative_prompt`, `num_images`, `seed` for image; etc.)

---

## Task 15 — generate-content Edge Function: Read Advanced Options

Update the `generate-content` Edge Function to read advanced option values from `job.metadata` and pass them to the AI provider API.

**Requirements:** 6.8
**Design:** Error Handling → generate-content Edge Function

### Sub-tasks

- [x] 15.1 — In the `generate-content` Edge Function, read advanced option values from `job.metadata` using safe fallbacks (e.g., `job.metadata?.model ?? 'gpt-4'`) so missing fields do not cause the function to throw
- [x] 15.2 — Pass the resolved values to the respective AI provider API call: `model`, `temperature`/`tone`, `size`/`resolution`, `style`, `voice_id`, `speaking_rate`, `pitch`, `stability` as applicable per content type

---

## Task 16 — Property-Based Tests

Install `fast-check` and write property-based tests for all 13 correctness properties defined in the design document.

**Requirements:** All (validation layer)
**Design:** Testing Strategy → Property-Based Tests

### Sub-tasks

- [x] 16.1 — Install `fast-check` as a dev dependency: `npm install --save-dev fast-check` in `frontend/`
- [x] 16.2 — Write PBT for **Property 1** (team selection by role priority): for any list of memberships, `selectActiveTeam` always returns the highest-priority role with earliest `created_at` tiebreaker (100 runs)
- [ ] 16.3 — Write PBT for **Property 2** (team switch clears stale data): after `setActiveTeam(B)`, no state slice contains rows with `team_id` equal to team A's id (100 runs)
- [ ] 16.4 — Write PBT for **Property 3** (navItems order invariant): for any render of `MainNavigation`, the top-level order matches the spec and Social Accounts/Media Library are leaf nodes (100 runs)
- [ ] 16.5 — Write PBT for **Property 4** (media service team_id propagation): for any `activeTeam`, every `mediaService` call passes `teamId = activeTeam.id` (100 runs)
- [ ] 16.6 — Write PBT for **Property 5** (storage path format): for any `teamId`, `userId`, `filename`, the path matches `{teamId}/{userId}/{epoch_ms}_{filename}` (100 runs)
- [ ] 16.7 — Write PBT for **Property 6** (null activeTeam guard): for any call with `activeTeam = null`, service functions return `null`/`[]` without calling Supabase (100 runs)
- [ ] 16.8 — Write PBT for **Property 7** (social service team_id propagation): for any `activeTeam`, every `socialService` call passes `teamId = activeTeam.id` and OAuth state contains `team_id` (100 runs)
- [ ] 16.9 — Write PBT for **Property 8** (OAuth callback team_id insertion): for any valid state with non-empty `team_id`, the Edge Function inserts a row with that `team_id` (100 runs)
- [ ] 16.10 — Write PBT for **Property 9** (OAuth callback rejects invalid state): for any absent/malformed/empty-team_id state, the Edge Function returns HTTP 400 and inserts no row (100 runs)
- [ ] 16.11 — Write PBT for **Property 10** (advanced options metadata round-trip): for any advanced options object, all fields appear in `content_jobs.metadata` and are passed to the AI provider (100 runs)
- [ ] 16.12 — Write PBT for **Property 11** (advanced options localStorage round-trip): for any options object and team_id/content_type, serialise then deserialise produces a deeply equal object (100 runs)
- [ ] 16.13 — Write PBT for **Property 12** (activeTeam localStorage persistence round-trip): switching to any team writes its id to localStorage; mounting with that value restores the same team (100 runs)
- [ ] 16.14 — Write PBT for **Property 13** (service safe defaults on error): for any service function, when Supabase throws, the function returns `null`/`[]`/`false` and does not propagate the exception (100 runs)

---

## Task 17 — TypeScript Compilation Gate

Verify the entire frontend compiles with zero TypeScript errors after all changes.

**Requirements:** 7.6, 9.2
**Design:** Testing Strategy → TypeScript Compilation Check

### Sub-tasks

- [ ] 17.1 — Run `npx tsc --noEmit` from `frontend/` and confirm exit code 0 with zero errors
- [ ] 17.2 — Fix any type errors introduced by this spec before marking this task complete

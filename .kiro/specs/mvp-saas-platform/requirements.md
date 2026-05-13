# Requirements Document

## Introduction

This document defines the requirements for the Creozel MVP SaaS Platform — a multi-tenant, managed SaaS product built on a React/TypeScript frontend and a self-hosted Supabase backend. The platform serves multiple isolated tenants (teams), each with their own scoped data, social account connections, media library, and AI content generation workspace. This spec governs four cross-cutting concerns that span the entire platform:

1. **Full multi-tenant architecture** — every resource is strictly isolated per tenant via Row Level Security and a tenant context enforced at every layer.
2. **Navigation restructure** — Social Accounts and Media Library are promoted to first-class items in the main navigation sidebar, not nested under Settings or any sub-menu.
3. **Tenant-scoped Media Library** — each tenant sees only their own media assets; no cross-tenant asset leakage is possible.
4. **Advanced content generation tools** — every content type (text, image, video, audio) exposes the full set of advanced configuration options in the UI.

This spec does not re-specify features already covered by `mvp-database-schema`, `mvp-social-accounts`, `mvp-media-library`, or `mvp-content-generation`. It extends and constrains those specs with the platform-level requirements described here.

---

## Glossary

- **Tenant**: A team workspace represented by a row in the `teams` table. All tenant-scoped data is linked via `team_id` and protected by RLS.
- **TenantContext**: The active `team_id` held in `AppContext` that is injected into every Supabase query made by the frontend.
- **Platform**: The Creozel SaaS application as a whole, serving multiple tenants from a single Supabase instance.
- **MainNavigation**: The React component at `frontend/src/components/layout/MainNavigation.tsx` that renders the sidebar and top header.
- **NavItem**: A single entry in the `navItems` array within `MainNavigation`, rendered as a top-level sidebar link or expandable group.
- **SocialAccounts**: The React page at `frontend/src/pages/SocialAccounts.tsx` that manages OAuth-linked social platform connections.
- **MediaLibrary**: The React page at `frontend/src/pages/MediaGallery.tsx` that manages tenant-scoped media assets.
- **ContentHub**: The React page at `frontend/src/pages/content/ContentHub.tsx` that provides AI content generation tools.
- **AdvancedOptions**: The full set of provider-level configuration parameters exposed per content type (e.g., model, temperature, style, voice, resolution).
- **RLS**: Row Level Security — PostgreSQL policies enforced by Supabase on every query to isolate data between tenants.
- **TenantSwitcher**: The UI control that allows a user to switch between teams they belong to, updating `TenantContext`.
- **social_connections**: The `social_connections` PostgreSQL table storing OAuth-linked platform accounts, scoped to `team_id`.
- **media_items**: The `media_items` PostgreSQL table storing media asset metadata, scoped to `team_id`.
- **content_jobs**: The `content_jobs` PostgreSQL table storing AI generation tasks, scoped to `team_id`.
- **AppContext**: The React context provider in `src/context/AppContext.tsx` that holds `user`, `activeTeam`, and `isDarkMode` state.

---

## Requirements

### Requirement 1 — Full Multi-Tenant Architecture

**User Story:** As a platform operator, I want every tenant's data to be completely isolated from every other tenant's data, so that no user can ever read, write, or infer data belonging to a different team.

#### Acceptance Criteria

1. THE `AppContext` SHALL maintain an `activeTeam` field of type `Team | null` representing the currently selected tenant, populated from the `teams` and `team_members` tables on authentication.
2. WHEN a user belongs to more than one team, THE `AppContext` SHALL default `activeTeam` to the team where the user holds the highest role (`owner` > `admin` > `editor` > `viewer`), using the earliest `created_at` as a tiebreaker.
3. THE `TenantSwitcher` component SHALL allow authenticated users who belong to multiple teams to switch `activeTeam` without triggering a URL navigation or full document reload.
4. WHEN `activeTeam` changes, THE `AppContext` SHALL clear all stale tenant-scoped data (social connections, media items, content jobs, scheduled posts, analytics) from state before re-fetching data for the new tenant, so that no previous tenant's data is visible during the transition.
5. EVERY Supabase query issued by the frontend that targets a tenant-scoped table (`social_connections`, `media_items`, `content_jobs`, `scheduled_posts`, `pipeline_executions`, `analytics_events`, `team_members`, `brand_profiles`) SHALL return only rows whose `team_id` equals `activeTeam.id`.
6. WHEN a re-fetch of tenant-scoped data after a team switch fails to complete within 10 seconds, THE system SHALL NOT display any data from the previous tenant and SHALL show an error indication to the user.
7. THE Database RLS policies SHALL enforce `team_id` isolation on every tenant-scoped table such that a query without a matching `team_members` row returns zero rows, not an error.
8. WHEN a user has no active team (personal workspace), THE `AppContext` SHALL set `activeTeam` to `null`.
9. WHILE `activeTeam` is `null`, ALL tenant-scoped queries SHALL filter with `team_id IS NULL`.
10. IF a user attempts to access a route that requires an active team and `activeTeam` is `null`, THEN THE route content SHALL NOT be rendered and THE system SHALL display a prompt for the user to create or join a team before the route content becomes visible.
11. WHILE a team is active, THE `TenantSwitcher` SHALL display the active team name and avatar in the sidebar user card area, replacing the personal user display.
12. WHEN a team is created, THE Database SHALL automatically create a `wallets` row for that team with `balance = 0` and `reserved = 0` via a PostgreSQL trigger.

---

### Requirement 2 — Social Accounts in Main Navigation

**User Story:** As a social media manager, I want Social Accounts to appear as a top-level item in the main navigation sidebar, so that I can access my connected platform accounts directly without navigating through Settings or any sub-menu.

#### Acceptance Criteria

1. THE `MainNavigation` component SHALL include a top-level `NavItem` with `title: 'Social Accounts'`, `href: '/social-accounts'`, and a `GlobeIcon` icon rendered in the "Navigation" section of the sidebar (the primary scrollable list of links).
2. THE `Social Accounts` `NavItem` SHALL appear in the main navigation section (not in `utilityItems` and not nested as a child of any other `NavItem`).
3. THE `Social Accounts` `NavItem` SHALL NOT appear as a child item under the `Publishing` group or any other expandable group.
4. WHEN the current route is `/social-accounts`, THE `MainNavigation` SHALL apply the same active highlight style applied to other active top-level items (e.g., Home, Create) to the `Social Accounts` nav item.
5. THE `Publishing` group in `navItems` SHALL NOT contain a child item linking to `/social-accounts` after this restructure.
6. THE `Settings` page integrations tab SHALL retain a read-only connection status summary for each connected platform.
7. THE `MainNavigation` `navItems` array SHALL maintain the following top-level order: Home, Create, Autopilot, Analytics, Publishing, Social Accounts, Media Library, Communication, Workflows.
8. THE `Settings` page integrations tab SHALL include a "Manage Connections" link that navigates to `/social-accounts`, and SHALL NOT contain a full social account management UI of its own.

---

### Requirement 3 — Media Library in Main Navigation

**User Story:** As a content creator, I want the Media Library to appear as a top-level item in the main navigation sidebar, so that I can access my tenant's media assets directly without navigating through Autopilot or any sub-menu.

#### Acceptance Criteria

1. THE `MainNavigation` component SHALL include a top-level `NavItem` with `title: 'Media Library'`, `href: '/media'`, and a `FolderIcon` icon rendered in the "Navigation" section of the sidebar.
2. THE `Media Library` `NavItem` SHALL appear in the main navigation section (not in `utilityItems` and not nested as a child of any other `NavItem`).
3. THE `Media Library` `NavItem` SHALL NOT appear as a child item under the `Autopilot` group, the `Publishing` group, or any other expandable group.
4. WHEN the current route is `/media`, THE `MainNavigation` SHALL apply the same active highlight style applied to other active top-level items (e.g., Home, Create) to the `Media Library` nav item.
5. THE `Autopilot` group in `navItems` SHALL NOT contain a child item linking to `/autopilot/media` or `/media` after this restructure.
6. THE `Publishing` group in `navItems` SHALL NOT contain a child item linking to `/media` after this restructure.
7. THE `MainNavigation` `navItems` array SHALL maintain the following top-level order: Home (`/`), Create (`/content`), Autopilot (`/autopilot`), Analytics (`/analytics`), Publishing (`/calendar`), Social Accounts (`/social-accounts`), Media Library (`/media`), Communication (`/messages`), Workflows (`/workflow`).

---

### Requirement 4 — Tenant-Scoped Media Library

**User Story:** As a tenant administrator, I want the Media Library to show only my team's media assets, so that content from other tenants is never visible to my team members.

#### Acceptance Criteria

1. THE `MediaLibrary` page SHALL pass `activeTeam.id` as the `team_id` filter on every call to `getMediaItems`, `uploadMediaItem`, and `deleteMediaItem` in `mediaService`.
2. WHEN `activeTeam` is `null` (personal workspace), THE `MediaLibrary` page SHALL filter media items with `team_id IS NULL`.
3. THE `media_items` RLS policy SHALL enforce that an authenticated user can only SELECT rows where `team_id` matches a team the user belongs to, as defined in `mvp-database-schema` Requirement 10.
4. THE `uploadMediaItem` function SHALL set `team_id` to `activeTeam.id` on every inserted `media_items` row.
5. WHEN the user selects a different active team, THE `MediaLibrary` page SHALL replace the current asset list with a loading indicator and then re-fetch assets scoped to the new `activeTeam.id`, so that no stale assets from the previous tenant remain visible.
6. THE `MediaLibrary` page SHALL display the active team name in the page header so users can confirm which tenant's library they are viewing.
7. THE Supabase Storage upload path SHALL be `{team_id}/{userId}/{unix_epoch_ms}_{filename}` so that storage objects are namespaced per tenant with a millisecond-precision timestamp.
8. THE `media` Storage bucket RLS policy SHALL deny SELECT, INSERT, UPDATE, and DELETE operations on files under a given `team_id` prefix to any user who does not have a matching row in `team_members` for that `team_id`.
9. IF `uploadMediaItem` or `deleteMediaItem` is called and `activeTeam.id` cannot be resolved (e.g., `activeTeam` is `null`), THEN THE function SHALL return `null` without performing any database or storage operation and SHALL call `reportError` with a descriptive message.

---

### Requirement 5 — Tenant-Scoped Social Accounts

**User Story:** As a tenant administrator, I want each team's social account connections to be fully isolated, so that connecting an Instagram account for one tenant does not expose it to any other tenant.

#### Acceptance Criteria

1. THE `SocialAccounts` page SHALL pass `activeTeam.id` as the `team_id` filter on every call to `getSocialConnections` and `disconnectSocialAccount` in `socialService`, and SHALL embed `activeTeam.id` in the OAuth `state` parameter when calling `getOAuthUrl`.
2. WHEN `activeTeam` is `null`, THE `SocialAccounts` page SHALL display an empty state containing a message explaining that a team is required and a call-to-action button to create or join a team.
3. THE `social_connections` RLS policy SHALL enforce that an authenticated user can only SELECT rows where `team_id` matches a `team_id` for which a row exists in `team_members` with the user's `user_id`.
4. WHEN the `oauth-connect` Edge Function receives a callback, THE function SHALL read `team_id` from the `state` parameter and SHALL set `team_id` on the inserted `social_connections` row.
5. IF the `state` parameter received by the `oauth-connect` Edge Function is absent or does not contain a valid non-empty `team_id`, THEN THE function SHALL reject the callback with a 400 error and SHALL NOT insert a `social_connections` row.
6. WHEN the user selects a different active team, THE `SocialAccounts` page SHALL clear its current connection list and re-fetch connections scoped to the new `activeTeam.id`.
7. THE `SocialAccounts` page SHALL display the active team name in the page header so users can confirm which tenant's connections they are managing.
8. EACH tenant SHALL support multiple connections per platform (e.g., two Instagram accounts for the same team), enforced by the UNIQUE constraint on `(team_id, platform, platform_account_id)` in `social_connections`.

---

### Requirement 6 — Advanced Content Generation Tools

**User Story:** As a content creator, I want every content generation tool to expose all advanced configuration options, so that I have full control over the AI output without needing to use a separate tool or API.

#### Acceptance Criteria

1. THE `ContentHub` text generation panel SHALL expose the following advanced options: AI model selector (GPT-4, GPT-3.5), tone selector (professional, casual, humorous, persuasive, informative), output format selector (blog post, caption, ad copy, thread, email), word count range (min integer input 1–10,000 and max integer input 1–10,000 where max ≥ min), language selector, and a brand voice toggle that injects the active team's `brand_profiles.voice_guidelines` into the system prompt.
2. THE `ContentHub` image generation panel SHALL expose the following advanced options: AI provider selector (DALL-E 3, Stable Diffusion via Replicate), image resolution selector (512×512, 1024×1024, 1792×1024, 1024×1792), style selector (photorealistic, illustration, digital art, oil painting, watercolor), negative prompt text input (maximum 500 characters), number of images selector (1–4), and a seed integer input (0–2,147,483,647) for reproducibility.
3. THE `ContentHub` video generation panel SHALL expose the following advanced options: AI model selector (GPT-4, GPT-3.5 for script generation), scene count selector (1–10), duration per scene selector (15s, 30s, 60s), aspect ratio selector (16:9, 9:16, 1:1), include B-roll suggestions toggle, and a brand voice toggle.
4. THE `ContentHub` audio generation panel SHALL expose the following advanced options: TTS provider selector (ElevenLabs, Whisper), voice selector (populated dynamically from the selected provider's available voices), speaking rate slider (0.5×–2.0×), pitch adjustment slider (−10 to +10 semitones), output format selector (MP3, WAV), and a stability/clarity slider (0–100) for ElevenLabs voices. IF the voice list fetch fails, THEN THE voice selector SHALL display a "Failed to load voices" message and disable the selector until a retry succeeds.
5. WHEN advanced options are changed, THE `ContentHub` SHALL update the credit cost estimate displayed to the user before generation begins, reflecting the cost of the selected model and options from the `pricing_config` table. IF the `pricing_config` table is unreachable, THEN THE credit cost estimate SHALL be hidden and an error indication SHALL be shown in its place.
6. THE advanced options panel for each content type SHALL be collapsible, defaulting to collapsed, so that users who do not need advanced configuration are not overwhelmed.
7. WHEN a generation job is submitted, THE `ContentHub` SHALL include all selected advanced option values in the `metadata` field of the `content_jobs` row so that the `generate-content` Edge Function can read them.
8. WHEN the `generate-content` Edge Function processes a job, THE function SHALL read advanced option values from `job.metadata` and pass them to the respective AI provider API call (e.g., `model`, `temperature`, `size`, `style`, `voice_id`, `speaking_rate`).
9. WHEN the `ContentHub` mounts, THE `ContentHub` SHALL fetch the active team's `brand_profiles` row and pre-populate the brand voice toggle state based on whether `voice_guidelines` is non-null. IF the `brand_profiles` fetch fails, THEN THE brand voice toggle SHALL default to off.
10. THE advanced options for each content type SHALL be persisted in `localStorage` keyed by `{team_id}:{content_type}:advancedOptions` so that a user's preferred settings are restored on next visit. IF `localStorage` is unavailable or the stored value is corrupt or unreadable, THEN THE advanced options panel SHALL initialise with the panel's default values.
11. IF the `pricing_config` table is unreachable when the `ContentHub` mounts or when advanced options change, THEN THE credit cost estimate display area SHALL show an error indication (e.g., "Cost estimate unavailable") and SHALL NOT show a stale or zero cost figure.

---

### Requirement 7 — Navigation Restructure Completeness

**User Story:** As a user, I want the navigation to be logically organised with Social Accounts and Media Library as first-class destinations, so that I can reach the most frequently used sections in one click.

#### Acceptance Criteria

1. THE `MainNavigation` `navItems` array SHALL be restructured so that the final top-level order is: Home (`/`), Create (`/content`), Autopilot (`/autopilot`), Analytics (`/analytics`), Publishing (`/calendar`), Social Accounts (`/social-accounts`), Media Library (`/media`), Communication (`/messages`), Workflows (`/workflow`). Both Social Accounts and Media Library entries SHALL be leaf nodes with no `children` array.
2. THE `Publishing` group SHALL contain only: Calendar (`/calendar`). The Social Accounts and Media Gallery child items SHALL be removed from this group.
3. THE `Autopilot` group SHALL contain only: Dashboard (`/autopilot`), Create Pipeline (`/autopilot/create`), Scheduler (`/autopilot/scheduler`). The Media Library child item SHALL be removed from this group.
4. THE `App.tsx` route for `/media` SHALL retain the same path string and render the same `MediaGallery` component as before this restructure; only the navigation entry point changes.
5. THE `App.tsx` route for `/social-accounts` SHALL retain the same path string and render the same `SocialAccounts` component as before this restructure; only the navigation entry point changes.
6. WHEN `npx tsc --noEmit` is executed from `frontend/` after the navigation restructure, THE TypeScript compiler SHALL exit with code 0 with zero type errors across the project.
7. THE `MainNavigation` component SHALL not introduce any new icon imports beyond those already imported from `lucide-react` in the existing file.

---

### Requirement 8 — Tenant Context Persistence

**User Story:** As a user, I want my active team selection to be remembered across page refreshes, so that I do not have to re-select my team every time I open the application.

#### Acceptance Criteria

1. WHEN `activeTeam` changes, THE `AppContext` SHALL write the new `activeTeam.id` to `localStorage` under the key `creozel:activeTeamId`.
2. WHEN `AppContext` initialises on mount, THE `AppContext` SHALL first resolve the full list of teams the user belongs to, then read `creozel:activeTeamId` from `localStorage` and set `activeTeam` to the matching team from that resolved list.
3. IF the stored `creozel:activeTeamId` does not match any team in the user's resolved team list, THEN THE `AppContext` SHALL fall back to selecting the first team in the list ordered by role priority (`owner` > `admin` > `editor` > `viewer`) with earliest `created_at` as a tiebreaker.
4. WHEN a user logs out, THE `AppContext` SHALL remove `creozel:activeTeamId` from `localStorage`.
5. IF `localStorage` is unavailable (e.g., throws a `SecurityError`) when reading or writing `creozel:activeTeamId`, THEN THE `AppContext` SHALL silently skip the persistence operation and continue with in-memory state only.
6. THE `activeTeam` state SHALL be accessible to all descendant components via the `useAppContext` hook, and `useAppContext` SHALL throw an error when called outside of an `AppProvider` tree.

---

### Requirement 9 — Error Handling and Code Quality

**User Story:** As a developer, I want all new and modified code to comply with the project's error handling and TypeScript standards, so that the codebase remains consistent and maintainable.

#### Acceptance Criteria

1. ALL `catch` blocks in `AppContext.tsx`, `MainNavigation.tsx`, `mediaService.ts`, `socialService.ts`, and `contentService.ts` SHALL use `catch (error: unknown)` and SHALL call `reportError` from `src/utils/errorReporter.ts` with a location string identifying the enclosing function name and file (e.g., `"fetchTeamData [AppContext.tsx]"`).
2. WHEN `npx tsc --noEmit` is executed from `frontend/` after all changes, THE TypeScript compiler SHALL exit with code 0 with no errors introduced by this spec.
3. THE `AppContextType` interface declaration, the `AppProvider` state initialisation, and the provider value object in `AppContext.tsx` SHALL each declare `activeTeam` as type `Team | null` using the `Team` type from `src/types/index.ts`, with no `any` types.
4. THE advanced options state in `ContentHub` SHALL be typed with explicit TypeScript interfaces per content type — `TextAdvancedOptions`, `ImageAdvancedOptions`, `VideoAdvancedOptions`, and `AudioAdvancedOptions` — each declaring at least one named field specific to that content type. No `Record<string, unknown>` or `any` types are permitted.
5. THE `TenantSwitcher` component SHALL declare explicit TypeScript props including at minimum `teams: Team[]` and `activeTeam: Team | null`, and SHALL NOT use `any` for team data.
6. IF a new service function introduced by this spec encounters an error, THEN THE function SHALL return `null` for single-object return types, `[]` for array return types, or `false`/`0` for boolean/numeric return types, and SHALL NOT throw to the caller.

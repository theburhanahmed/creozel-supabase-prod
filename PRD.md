# Product Requirements Document — Creozel

**Version:** 2.0  
**Date:** May 4, 2026  
**Status:** Living Document

---

## 1. Executive Summary

Creozel is an all-in-one product for organic growth, built for creators, marketers, agencies, and brands. It replaces the fragmented social content workflow by letting teams generate, publish, learn from, and improve social content — text, image, video, and audio — from a single workspace. The platform is built on a self-hosted Supabase stack (PostgreSQL + GoTrue auth + PostgREST + Storage + Edge Functions) with a React frontend, abstracting the complexity of multiple AI providers and social media APIs behind a team-friendly interface with transparent credit-based billing.

---

## 2. Problem Statement

Content teams face four compounding problems:

1. **Fragmented workflow.** Generation, scheduling, publishing, performance review, and iteration are split across separate tools, so context is lost between each step.
2. **Manual repetition.** Distributing the same content across Instagram, YouTube, LinkedIn, TikTok, Twitter/X, and Facebook requires manual effort for each platform, every time.
3. **No feedback loop.** Performance data lives in analytics dashboards that are disconnected from the creation tools, so lessons from top-performing content rarely inform the next cycle.
4. **Unpredictable AI costs.** Most AI generation tools charge per-call with no visibility into spend until the invoice arrives.

Creozel solves this by combining AI generation, multi-platform publishing, automation pipelines, performance learning, and usage-based credit billing into one product.

---

## 3. Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Solo Creator** | Individual influencer or content marketer | Fast AI-assisted content generation and scheduling |
| **Marketing Agency** | Team managing multiple brand accounts | Multi-workspace collaboration, bulk scheduling, analytics |
| **Social Media Manager** | In-house role at a brand | Calendar view, approval workflows, platform analytics |
| **Growth Hacker** | Startup marketer running experiments | A/B testing, pipeline automation, cost control |

---

## 4. Goals and Non-Goals

### Goals
- Drive organic growth by unifying content creation, scheduling, publishing, learning, and iteration in one product
- Support all major social platforms (Instagram, YouTube, Twitter/X, Facebook, LinkedIn, TikTok)
- Provide transparent, predictable credit-based billing with real-time balance visibility
- Support team collaboration with role-based access control
- Automate recurring content workflows via n8n-based pipelines that generate text, image, video, and audio
- Deliver AI-generated text, images, video, and audio from a unified interface
- Close the feedback loop by using performance data to inform future content and pipeline behavior

### Non-Goals
- Replacing dedicated analytics platforms (Creozel provides first-party engagement data, not cross-channel attribution)
- White-label reselling (not in current scope)
- Native mobile apps (web-first; mobile-responsive)
- Direct video editing or post-production (Creozel generates final video cuts)

---

## 5. Platform Architecture

### 5.1 System Overview

```
┌──────────────────────────────────────────────────────────────┐
│  GitHub Actions CI  (consolidated ci.yml)                    │
└────────────────────────┬─────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌─────────────────────┐       ┌──────────────────────┐
│  Supabase (self-    │       │  React Frontend      │
│  hosted via Docker) │◄──────│  frontend/           │
│  Port 8000 (Kong)   │ HTTPS │  Port 5173 (dev)     │
│                     │       │  13+ pages           │
│  GoTrue (auth)      │       │  Tailwind CSS        │
│  PostgREST (API)    │       │  React Context       │
│  PostgreSQL (DB)    │       │  Vite build          │
│  Storage (files)    │       │                      │
│  Edge Functions     │       │                      │
│  Realtime           │       │                      │
└────────┬────────────┘       └──────────────────────┘
         │
    ┌────┴──────┐   ┌───────┐
    │ n8n       │   │Ollama │
    │ (pipelines│   │(local │
    │  /webhooks│   │  AI)  │
    └───────────┘   └───────┘
```

### 5.2 Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- Tailwind CSS
- React Context (auth/global state)
- FullCalendar v6 (scheduling), Recharts (analytics)
- `@supabase/supabase-js` — single data client for all API calls
- Deployed on Vercel

**Backend — Supabase (self-hosted)**
- **GoTrue** — authentication (email/password, JWT sessions, password reset)
- **PostgREST** — auto-generated REST API over PostgreSQL (`/rest/v1/`)
- **PostgreSQL 15+** — primary database with Row Level Security (RLS)
- **Supabase Storage** — file storage for media assets (images, audio, video)
- **Supabase Edge Functions** (Deno) — serverless functions for AI generation, webhooks, billing hooks
- **Supabase Realtime** — live subscriptions for job status, notifications
- **Kong** — API gateway (port 8000 locally)

**Automation**
- **n8n** (self-hosted) — visual workflow automation for content pipelines and scheduled tasks

**AI Providers** (called from Edge Functions)
- Text: OpenAI GPT-4, GPT-3.5
- Images: DALL-E 3, Stable Diffusion (via Replicate)
- Video: OpenAI GPT-4 (script/planning) + image/TTS providers + assembly step (e.g., FFmpeg or Replicate) for final MP4
- Audio/TTS: ElevenLabs, Whisper
- Local inference: Ollama (llama3.2, nomic-embed-text)

**Payments**
- Stripe (global)
- Razorpay (India)

**Infrastructure**
- Docker + Docker Compose (local dev and self-hosted production)
- GitHub Actions CI/CD
- Sentry (error monitoring)

---

## 6. Feature Specifications

### 6.1 Authentication & User Management

**Description:** Email/password signup and login via Supabase GoTrue. Session management is handled entirely by the `@supabase/supabase-js` client. Social OAuth is used exclusively for connecting publishing accounts, not for platform login.

**Requirements:**
- Users register with email and password; email verification required before first login (configurable via `ENABLE_EMAIL_AUTOCONFIRM`)
- JWT access + refresh token rotation managed by the Supabase client (`autoRefreshToken: true`)
- Password reset via email link using GoTrue's recovery flow
- User profile data stored in a `profiles` table in PostgreSQL, linked to `auth.users` via trigger
- Profile fields: display name, avatar URL, bio, phone number, timezone, notification preferences
- Brand profile stored in a `brand_profiles` table: brand name, logo URL, voice guidelines, tone settings (injected into AI generation prompts)
- Onboarding state tracked in `profiles.onboarding_completed`; incomplete onboarding surfaces a guided checklist on the dashboard
- Login form submit is debounced (1 s) and the submit button is disabled while a request is in-flight
- All auth state is managed via `supabase.auth.onAuthStateChange` — no localStorage hacks

**Roles (enforced via RLS policies):**

| Role | Scope | Permissions |
|---|---|---|
| Platform Admin | Global | Full access, user management |
| Team Owner | Team | All team actions, billing, delete team |
| Team Admin | Team | Manage members, settings, all content |
| Team Editor | Team | Create, edit, publish content |
| Team Viewer | Team | Read-only access |

---

### 6.2 AI Content Generation

**Description:** A unified generation interface that routes prompts to the appropriate AI provider via Supabase Edge Functions. All generation is asynchronous — jobs are inserted into a `content_jobs` table and the frontend subscribes to status changes via Supabase Realtime.

**Content Types:**

| Type | Provider(s) | Output |
|---|---|---|
| Text / Copy | OpenAI GPT-4 | Blog posts, captions, ad copy, threads |
| Image | DALL-E 3, Stable Diffusion (Replicate) | PNG/JPEG assets |
| Video | OpenAI GPT-4 + image/TTS/assembly providers | Full MP4 file: image sequence + TTS narration + soundtrack |
| Audio / TTS | ElevenLabs, Whisper | MP3 audio files |

**Generation Flow:**
1. User submits a prompt with content type, tone, and optional brand context
2. Frontend inserts a `content_jobs` row with `status: 'pending'` and reserves credits
3. A Supabase Edge Function (`/functions/v1/generate-content`) is invoked, calls the AI provider, and updates the job row
4. Frontend subscribes to `content_jobs` row changes via Realtime — no polling required
5. On completion, the generated asset is uploaded to Supabase Storage and the public URL is stored on the job row
6. Credits are deducted from the active team's wallet on successful completion; reserved credits are released on failure

**Requirements:**
- Credit cost is estimated and displayed before generation begins
- Users can cancel in-progress jobs; reserved credits are released immediately
- Generated content is saved to the Media Library automatically
- Brand voice guidelines from the active team's Brand Profile are injected into the Edge Function system prompt
- Generation errors surface as toast notifications with actionable messages
- Content generation page must call real Edge Function endpoints — no mock data or `setTimeout` simulation

---

### 6.3 Social Platform Integrations

**Description:** OAuth2 connections to six social platforms, enabling direct publishing and scheduled posting from within Creozel.

**Supported Platforms:** Instagram, YouTube, Twitter/X, Facebook, LinkedIn, TikTok

**Requirements:**
- Users connect accounts via OAuth2; tokens are stored encrypted in a `social_connections` table using Supabase Vault
- Multiple accounts per platform are supported (e.g., two Instagram accounts)
- Connected accounts are scoped to a team; team members with Editor role or above can publish
- Platform connection status is visible in the Settings → Integrations page
- Disconnecting an account revokes the stored token and cancels any scheduled posts for that account
- Incoming platform webhooks are handled by a Supabase Edge Function, stored as `webhook_events` rows, and processed asynchronously

**Publishing Modes by Platform:**

| Platform | Direct Publish | Schedule | Notes |
|---|---|---|---|
| Twitter/X | Yes | Yes | Text, images, video, polls via API |
| LinkedIn | Yes | Yes | Posts, articles, images, video via API |
| Facebook | Yes | Yes | Page posts, images, video via Graph API |
| Instagram | Posts / Carousels only | Yes | Reels and Stories require manual finalization in the mobile app |
| TikTok | Feed videos only | Yes | Direct Post API; other formats (e.g., Stories, LIVE) out of scope |
| YouTube | Yes | Yes | Videos via YouTube Data API; Shorts via standard upload endpoint |

**Publishing Requirements:**
- Posts can be published immediately or scheduled for a future datetime
- Scheduled posts appear on the Calendar view
- Post status lifecycle: `draft → scheduled → published | failed`
- Failed posts surface an error message with the platform's error code
- All connection flows use the OAuth redirect pattern via Edge Functions

---

### 6.4 Content Calendar

**Description:** A FullCalendar-based view of all scheduled posts across platforms, with click-through to post details.

**Requirements:**
- Calendar loads scheduled posts from the `scheduled_posts` table via PostgREST (`/rest/v1/scheduled_posts?status=eq.scheduled`) on mount — no hardcoded events
- Each event is color-coded by platform
- Clicking an event opens a post detail modal showing content, platform, scheduled time, and status
- Users can reschedule a post by dragging it to a new date/time (drag-and-drop updates the row via PostgREST PATCH)
- Calendar supports month, week, and day views
- Failed posts are shown in red with an error indicator

---

### 6.5 Automation Pipelines

**Description:** Pipelines are the automation core of Creozel. Users build them in a simplified Creozel pipeline builder that produces n8n-compatible JSON under the hood. A pipeline can generate multi-format content (text, image, video, and audio) on a schedule or webhook, optionally transform it, publish to one or more social platforms, and feed performance data back into future runs. The automation style is similar to Faceless.video, but broader: multi-format generation, multi-platform publishing, performance learning, and iterative improvement are all handled in the same workflow.

**Pipeline Components:**
- **Trigger:** Cron schedule or webhook (configured in the builder and rendered as n8n trigger nodes)
- **Steps:** Generate content (text, image, video, audio via Edge Function webhook) → optionally transform → publish to one or more platforms → collect performance data → adjust future prompts or scheduling
- **Templates:** Reusable pipeline configurations stored as JSON in a `pipeline_templates` table; the builder can instantiate a template into an editable n8n workflow

**Requirements:**
- Users create and manage pipelines through a simplified Creozel builder that generates n8n JSON; advanced users can export and edit the raw JSON
- A single pipeline can generate text, image, video, and audio content and route each asset to the appropriate platform
- Video generation produces full video files: an image sequence + TTS narration + soundtrack, assembled into a final MP4 via the `generate-content` Edge Function
- Each pipeline execution is logged in a `pipeline_executions` table with status (`pending`, `running`, `completed`, `failed`) and duration
- Generated outputs are tracked in a `pipeline_outputs` table linking each execution to the resulting `content_jobs`, `media_items`, and optional `scheduled_posts`
- The Workflow Dashboard shows real stats from the `pipeline_executions` table via PostgREST — no hardcoded values
- Stats displayed: active pipeline count, total executions, estimated time saved (hours), success rate
- Users can pause, resume, or delete pipelines
- Failed executions show the step that failed and the error message
- Performance results from published pipeline outputs are available as inputs to the next pipeline iteration

---

### 6.6 Analytics

**Description:** Performance tracking for published content, with per-platform breakdowns and AI-powered recommendations.

**Metrics Tracked:**
- Content generation volume by type
- Per-post engagement: likes, comments, shares, reach, impressions (synced from platform APIs)
- Credit consumption over time
- Pipeline success rates

**Requirements:**
- Dashboard overview loads from the `analytics_overview` view in PostgreSQL via PostgREST — no hardcoded values
- Analytics events are tracked in an `analytics_events` table for key user actions (content generated, post published, pipeline run)
- Per-platform analytics show engagement trends over selectable time ranges (7d, 30d, 90d)
- AI-powered suggestions are generated based on top-performing content patterns via an Edge Function

---

### 6.7 Credits & Billing

**Description:** A wallet-based credit system where teams purchase credit bundles or subscribe to plans that include an unlimited-generation tier for specific content types. The wallet is scoped to the active team (tenant); all team members share the same balance and billing.

**Credit System:**
- Each team has a `wallets` row in PostgreSQL with a real-time balance
- Credits are reserved at job creation and deducted on completion (or released on failure) via database functions
- Transaction history is stored in a `credit_transactions` table with type labels: `purchase`, `deduction`, `refund`, `bonus`
- Credit cost per content type is configurable in a `pricing_config` table
- Subscription plans may include unlimited-generation tiers for specific content types (e.g., unlimited text generation on Pro); unlimited items bypass credit reservation and record a zero-cost transaction for auditing

**Billing:**
- Subscription plans are managed via Stripe (global) and Razorpay (India)
- Stripe webhooks are handled by a Supabase Edge Function that updates the `subscriptions` table
- Plans include: Free, Starter, Pro, Agency
- Invoices are generated per billing cycle and downloadable as PDF
- Users can add/remove payment methods from the Billing settings page
- Overage beyond plan credits can be purchased as top-ups
- Team Owner and Team Admin roles manage billing and can view the team wallet; Editors and Viewers do not have billing access

---

### 6.8 Team Collaboration

**Description:** Multi-user workspaces where teams share content, pipelines, social connections, analytics, and a single tenant-level wallet.

**Requirements:**
- A user can create or join multiple teams; they switch between teams via a workspace selector
- Team data is stored in a `teams` table; membership in `team_members` with role column
- Team owners can invite members by email; invitations stored in `team_invitations` and expire after 7 days
- Role changes take effect immediately (RLS policies re-evaluated on next request)
- All resources (posts, pipelines, media, analytics, wallets, social connections) are scoped to the active team via `team_id` foreign keys and RLS
- The team wallet is the single billing boundary for the tenant: all generation, publishing, and storage costs are charged to the active team's wallet
- Team activity log stored in `team_activity_log`
- Team owners can transfer ownership to another admin

---

### 6.9 Media Library

**Description:** A centralized asset store for all AI-generated and uploaded media, organized and reusable across posts and pipelines.

**Requirements:**
- All generated content is automatically saved to Supabase Storage and indexed in a `media_items` table
- Users can upload their own assets (images, audio, video clips) directly to Supabase Storage
- Assets are filterable by type, date, and tags
- Assets can be attached to posts directly from the library
- Storage usage is displayed and counted against plan limits (tracked in `storage_usage` view)

---

### 6.10 Notifications

**Description:** Real-time alerts for key platform events via Supabase Realtime.

**Notification Triggers:**
- Content generation completed or failed
- Scheduled post published or failed
- Pipeline execution completed or failed
- Team invitation received
- Credit balance below threshold
- Subscription renewal upcoming

**Requirements:**
- Notifications stored in a `notifications` table; frontend subscribes via Supabase Realtime
- Email notifications sent via Supabase's built-in email or an Edge Function calling an SMTP provider
- Users can configure which events trigger email vs. in-app notifications (stored in `profiles.notification_preferences`)

---

### 6.11 Affiliate Program

**Description:** A referral system that rewards users for bringing new paying customers to the platform.

**Requirements:**
- Each user gets a unique referral code stored in `profiles.referral_code`
- Referral clicks and conversions tracked in `referral_events` table
- Referral earnings tracked in `affiliate_earnings` table
- Payouts processed on a defined schedule via Edge Function
- Referral attribution tracked for 30 days from first click

---

## 7. Data Layer

All data access goes through the Supabase client (`@supabase/supabase-js`). There is no separate backend API server.

**Access Patterns:**

| Data | Method |
|---|---|
| CRUD on tables | `supabase.from('table_name')` via PostgREST |
| File upload/download | `supabase.storage.from('bucket')` |
| AI generation, webhooks | `supabase.functions.invoke('function-name')` |
| Real-time updates | `supabase.channel().on('postgres_changes', ...)` |
| Auth | `supabase.auth.*` |

**Core Tables:**

| Table | Purpose |
|---|---|
| `profiles` | Extended user data linked to `auth.users` |
| `brand_profiles` | Brand identity settings per user/team |
| `teams` | Team workspaces |
| `team_members` | User ↔ team membership with roles |
| `team_invitations` | Pending email invitations |
| `content_jobs` | AI generation job queue and results |
| `scheduled_posts` | Posts queued for publishing |
| `social_connections` | OAuth-linked platform accounts |
| `webhook_events` | Incoming platform webhook payloads |
| `pipeline_executions` | n8n workflow run logs |
| `pipeline_outputs` | Links each pipeline execution to generated content, media, and scheduled posts for feedback-loop tracking |
| `media_items` | Media library index |
| `wallets` | Credit balances per team (tenant) |
| `credit_transactions` | Credit debit/credit history |
| `pricing_config` | Credit cost per content type and unlimited-generation plan entitlements |
| `subscriptions` | Stripe/Razorpay subscription state |
| `notifications` | In-app notification feed |
| `analytics_events` | User action tracking |
| `referral_events` | Affiliate click/conversion tracking |
| `affiliate_earnings` | Affiliate payout ledger |

**Standards:**
- All tables have Row Level Security (RLS) enabled
- Team-scoped tables include a `team_id` column with RLS policies enforcing team membership
- All timestamps are `timestamptz` (UTC)
- Soft deletes use `deleted_at timestamptz` where applicable

---

## 8. Security Requirements

- OAuth tokens for social platforms are stored encrypted using Supabase Vault
- RLS policies enforce data isolation between teams and users
- JWT tokens are managed by GoTrue with configurable expiry (`JWT_EXPIRY=3600`)
- CORS is restricted to known frontend domains via Kong configuration
- Rate limiting applied to auth endpoints via GoTrue configuration
- All user-uploaded files are stored in private Supabase Storage buckets with signed URLs
- `DISABLE_SIGNUP` can be toggled to restrict new registrations
- Sentry captures all unhandled exceptions in production

---

## 9. Frontend Architecture Requirements

- `@supabase/supabase-js` is the **single canonical data client** — no other HTTP clients (`axios`, `fetch` wrappers) in `src/services/`
- All `catch` blocks use `catch (error: unknown)` with type guards — no `catch (error: any)`
- `console.error` / `console.warn` in service files are replaced with `reportError` / `reportWarning` from `src/utils/errorReporter.ts`
- TypeScript strict mode is enabled and `npx tsc --noEmit` must exit 0
- Pages that display live data (Dashboard, Calendar, WorkflowDashboard, ContentHub) must call real Supabase endpoints — no mock data, hardcoded arrays, or `setTimeout` simulations
- Auth state is sourced exclusively from `supabase.auth.onAuthStateChange` via `AppContext`
- Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the only required frontend env vars

---

## 10. Infrastructure & DevOps Requirements

- Self-hosted Supabase runs via Docker Compose (`docker-compose.yml`)
- n8n runs as a Docker service alongside Supabase
- Ollama runs as a Docker service for local AI inference
- A single `ci.yml` workflow handles: frontend lint/type-check/build, Docker build, and E2E tests
- `VITE_SUPABASE_URL` is the canonical environment variable name for the frontend Supabase URL
- The frontend working directory is `frontend/` in all CI and deployment configs
- `db.sqlite3` is gitignored and never committed
- Operational docs live in `docs/ops/`

---

## 11. Testing Requirements

- Frontend: Unit tests for `errorReporter.ts` and `debounce.ts` utilities
- Frontend: Integration tests for auth flow (login, register, logout)
- E2E tests run on PRs using Playwright with `PLAYWRIGHT_BASE_URL` env var
- Supabase migrations are tested by running them against a clean PostgreSQL instance in CI

---

## 12. MVP Development Gaps

The following gaps represent the remaining work to reach a shippable MVP. Each gap maps to a spec in `.kiro/specs/`.

| # | Area | Gap | Spec | Priority |
|---|---|---|---|---|
| 1 | Auth | `authService` still uses Supabase correctly but `AppContext` comment says "Supabase" — verify full flow works end-to-end | — | 🔴 Critical |
| 2 | Frontend | Dashboard stats are hardcoded `'—'`; needs real data from `analytics_overview` view | `mvp-dashboard` | 🔴 Critical |
| 3 | Frontend | `Calendar.tsx` is a stub; needs FullCalendar wired to `scheduled_posts` table | `mvp-calendar` | 🔴 Critical |
| 4 | Frontend | `ContentHub.tsx` is a stub; needs AI generation UI wired to Edge Functions | `mvp-content-generation` | 🔴 Critical |
| 5 | Frontend | `WorkflowDashboard.tsx` is a stub; needs real pipeline stats from `pipeline_executions` | `mvp-workflow-dashboard` | 🟠 High |
| 6 | Frontend | `Settings.tsx` is a stub; needs profile, brand, integrations, notifications tabs | `mvp-settings` | 🟠 High |
| 7 | Frontend | `SocialAccounts.tsx` is a stub; needs OAuth connection UI | `mvp-social-accounts` | 🟠 High |
| 8 | Database | Core tables (`profiles`, `content_jobs`, `scheduled_posts`, etc.) need migrations | `mvp-database-schema` | 🔴 Critical |
| 9 | Edge Functions | `generate-content` Edge Function needs to be created | `mvp-content-generation` | 🔴 Critical |
| 10 | Frontend | Credits pages (AddCredits, TransactionHistory, UsageHistory) are stubs | `mvp-credits-billing` | 🟠 High |
| 11 | Frontend | `Notifications.tsx` is a stub; needs Realtime subscription | `mvp-notifications` | 🟡 Medium |
| 12 | Frontend | `Team.tsx` is a stub; needs invite/role management UI | `mvp-team` | 🟡 Medium |
| 13 | Frontend | `UserProfile.tsx` is a stub; needs profile edit form | `mvp-settings` | 🟠 High |
| 14 | Frontend | `MediaGallery.tsx` is a stub; needs Storage integration | `mvp-media-library` | 🟡 Medium |
| 15 | Frontend | `AffiliatePage.tsx` is a stub | `mvp-affiliate` | 🟢 Low |
| 16 | Code Quality | TypeScript strict mode not verified (`npx tsc --noEmit` may fail) | — | 🟠 High |
| 17 | Code Quality | `errorReporter.ts` utility does not exist yet | — | 🟠 High |
| 18 | Docs | Migration rollback documentation missing | — | 🟡 Medium |

---

## 13. Roadmap (Post-MVP)

| Feature | Priority | Notes |
|---|---|---|
| Advanced Media Library | Medium | Tagging, search, bulk operations |
| Voice Cloning | Medium | Custom voice synthesis via ElevenLabs |
| Developer SDK & Public API | Medium | Third-party integrations, webhooks out |
| Predictive Analytics | Low | AI-powered performance forecasting |
| Content Approval Workflows | Low | Multi-step review before publishing |
| White-label / Agency Mode | Low | Custom branding for agency clients |

---

## 14. Glossary

| Term | Definition |
|---|---|
| **Pipeline** | The automation core of Creozel: an n8n workflow that can generate text, image, video, and audio content, publish to multiple platforms, learn from performance data, and iterate on future outputs |
| **ContentJob** | An async AI generation task tracked in the `content_jobs` table |
| **Wallet** | A team's credit balance (tenant-level) stored in the `wallets` table |
| **Credit** | The unit of currency for AI generation; purchased in bundles or included in plans |
| **SocialConnection** | An OAuth-linked social platform account stored in `social_connections` |
| **BrandProfile** | A user's brand identity settings injected into AI generation prompts |
| **RLS** | Row Level Security — PostgreSQL policies enforced by Supabase on every query |
| **Edge Function** | A Deno serverless function deployed on Supabase, used for AI calls and webhooks |
| **GoTrue** | Supabase's authentication server handling JWT sessions |
| **PostgREST** | Supabase's auto-generated REST API layer over PostgreSQL |

---

## 15. Implementation Plan — Next Dev Cycle

The next cycle focuses on the core product loop: generating multi-format content, publishing it, surfacing performance, and running the first pipeline end-to-end. All items below are drawn from the MVP gaps in Section 12 and grouped by priority and dependency.

### Wave 1: Foundation (Critical — Unblocks everything)

| # | Task | Why | Spec | Definition of Done |
|---|---|---|---|---|
| 1 | Finalize core database schema migrations | All frontend pages depend on these tables | `mvp-database-schema` | Migrations run cleanly in CI; `profiles`, `content_jobs`, `scheduled_posts`, `pipeline_executions`, `pipeline_outputs`, `media_items`, `wallets`, `social_connections` exist with RLS enabled; `wallets` has a single row per `team_id` |
| 2 | Implement `generate-content` Edge Function | Needed for text, image, video, and audio generation | `mvp-content-generation` | Function accepts content type, prompt, brand context; returns job ID; for video, assembles image sequence + TTS + soundtrack into MP4; updates `content_jobs` and `media_items` on completion |
| 3 | Verify auth end-to-end and tenant-level wallet wiring | Login/register/logout and team wallet must be solid before users can access the product | `mvp-auth-flow`, `mvp-credits-billing` | `AppContext` listens to `onAuthStateChange`; login/register forms work; RLS policies active; `wallets` is team-scoped and shared across team members |

### Wave 2: Content Loop (Critical — Proves the core promise)

| # | Task | Why | Spec | Definition of Done |
|---|---|---|---|---|
| 4 | Complete `ContentHub.tsx` | Unified generation UI for text, image, video, audio | `mvp-content-generation` | Real Edge Function calls, job status via Realtime, results saved to Media Library, credit estimate shown before generation; video output is a full MP4 |
| 5 | Complete `Calendar.tsx` | Scheduling and rescheduling is central to publishing | `mvp-calendar` | FullCalendar wired to `scheduled_posts`, drag-and-drop updates, color-coded platforms, failed posts shown in red |
| 6 | Complete `WorkflowDashboard.tsx` | Pipelines are the automation core; this is the control surface | `mvp-workflow-dashboard` | Live stats from `pipeline_executions`, pause/resume/delete actions, failed-step details, TypeScript strict clean |
| 7 | Build `MediaGallery.tsx` | Generated assets must be reusable across posts and pipelines | `mvp-media-library` | Storage-backed gallery, filter by type, attach to posts; supports full MP4 video playback |

### Wave 3: Growth Loop (High — Closes the feedback cycle)

| # | Task | Why | Spec | Definition of Done |
|---|---|---|---|---|
| 8 | Complete `Dashboard.tsx` | Organic growth requires real performance overview | `mvp-dashboard` | Stats from `analytics_overview` view, no hardcoded placeholders, links to top-performing content |
| 9 | Complete social accounts + OAuth connection UI | Publishing to platforms requires authenticated connections | `mvp-social-accounts` | OAuth flows, `social_connections` rows, disconnect/revoke, scoped to team |
| 10 | Complete credits and billing pages | Predictable cost control and unlimited tiers are core differentiators | `mvp-credits-billing` | Team wallet balance, transaction history, usage history, top-up UI; plan configuration supports unlimited generation tiers for specific content types |
| 11 | Complete `Settings.tsx` and `UserProfile.tsx` | Brand voice, integrations, and profile settings feed generation quality | `mvp-settings` | Profile, brand, integrations, notification tabs functional |

### Wave 4: Collaboration & Polish (Medium — Team readiness)

| # | Task | Why | Spec | Definition of Done |
|---|---|---|---|---|
| 12 | Complete `Notifications.tsx` | Real-time alerts for generation, publishing, and pipeline failures | `mvp-notifications` | Realtime subscription, email preferences, dismiss/read states |
| 13 | Complete `Team.tsx` | Agencies and brands need multi-user workspaces | `mvp-team` | Invite by email, role management, team switching, activity log |
| 14 | Enforce TypeScript strict mode and `errorReporter.ts` | Code quality gates for shipping | `mvp-typescript-strict`, `mvp-error-reporter` | `npx tsc --noEmit` exits 0; all service `catch` blocks use `catch (error: unknown)` and report via `errorReporter.ts` |

### Wave 5: Pipeline as Automation Core (High — Product differentiator)

| # | Task | Why | Spec | Definition of Done |
|---|---|---|---|---|
| 15 | Define pipeline templates for multi-format content | Show users how to automate text, image, video, and audio from one workflow | `mvp-workflow-dashboard` | At least three reusable n8n templates in repo: blog/carousel post, short-form video, audio snippet |
| 16 | Build the simplified Creozel pipeline builder | The core promise is a Creozel-native automation experience, not just n8n exposure | `mvp-workflow-dashboard` (new builder spec) | Builder UI supports trigger, content-type steps, transform rules, and publish targets; exports valid n8n JSON; can instantiate templates |
| 17 | Connect pipeline outputs to publishing and analytics | A pipeline is only useful if it can publish and learn | `mvp-workflow-dashboard`, `mvp-calendar`, `mvp-analytics` | Generated assets are auto-scheduled, `pipeline_outputs` links posts to executions, success metrics appear in dashboard |

### Ordering Notes
- **Do not start Wave 2 until Wave 1 database migrations, the `generate-content` Edge Function, and the tenant-level wallet are in place.**
- **Wave 5 is the highest product-priority differentiator but depends on Waves 2–4; start scaffolding templates and the builder UI once `ContentHub` is generating real assets (especially full MP4 video).**
- **Code-quality tasks (Wave 4) should run in parallel with feature work, not as a final cleanup pass.**
- **The `pipeline_outputs` table (Wave 1) must be implemented before Wave 5 feedback-loop work can be completed.**

---

## 16. Decisions, Assumptions & Open Questions

### Decisions
1. **Pipeline authoring UX:** Users build pipelines in a simplified Creozel pipeline builder that generates n8n-compatible JSON under the hood. Advanced users can export/import raw JSON for direct n8n editing.
2. **Performance feedback loop:** Use a dedicated `pipeline_outputs` table. Each pipeline execution produces one or more outputs, each linked to a `content_job_id`, optional `media_item_id`, and optional `scheduled_post_id`. This decouples pipeline runs from published posts and lets a single execution generate multiple assets.
3. **Video/audio generation scope:** Pipelines generate full video files: image sequence + TTS narration + soundtrack, assembled into a final MP4. No native editor is required; generated cuts are final.
4. **Platform publishing depth:** Direct publishing and scheduling are supported for Twitter/X, LinkedIn, Facebook, and YouTube. Instagram supports direct publishing for posts and carousels only; Reels and Stories require manual finalization in the mobile app. TikTok supports feed videos via the Direct Post API; other formats are out of scope.
5. **Pricing model:** Plans include credit-based generation and unlimited-generation tiers for specific content types (e.g., unlimited text on Pro). Unlimited items are recorded as zero-cost transactions for auditing.
6. **Team isolation for pipelines:** Pipelines, executions, outputs, and wallets are owned by the team (tenant). All team members in the active workspace share the team wallet; personal wallets are not used.

### Assumptions
- The Supabase self-hosted stack (PostgreSQL, GoTrue, PostgREST, Storage, Edge Functions, Realtime) remains the production backend; no new backend service is introduced.
- n8n remains the pipeline execution engine; the Creozel builder generates n8n-compatible JSON that can be run by the embedded n8n instance.
- "Organic growth" is measured by first-party engagement metrics (likes, comments, shares, reach, impressions) synced from platform APIs; cross-channel attribution is out of scope.
- "Video generation" in the pipeline context means a complete MP4 file generated from image sequence + TTS + soundtrack via external AI providers; native video editing is not required.
- Credit costs are uniform per content type at first; per-model or per-platform pricing can come later.

### Open Questions
1. **Video provider selection:** Which external provider(s) will assemble the final MP4 (e.g., Replicate, Runway, Pika, or a custom FFmpeg pipeline on Supabase Storage)? This affects cost and quality.
2. **n8n licensing/hosting:** Will the embedded n8n editor be self-hosted inside the same Docker Compose stack, or will we call a managed n8n instance? This affects builder integration complexity.
3. **Unlimited-tier enforcement:** Should unlimited-generation limits be enforced by plan type in `pricing_config` or by feature flags on the `subscriptions` table?
4. **Storage billing:** Is media storage counted against the team wallet as credits, or is it a separate storage quota per plan?

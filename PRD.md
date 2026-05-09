# Product Requirements Document — Creozel

**Version:** 2.0  
**Date:** May 4, 2026  
**Status:** Living Document

---

## 1. Executive Summary

Creozel is an AI-powered SaaS content automation platform that lets content creators, marketers, and agencies generate multi-format content (text, image, video, audio), schedule and auto-publish it across major social platforms, and track performance — all from a single workspace. The platform is built on a self-hosted Supabase stack (PostgreSQL + GoTrue auth + PostgREST + Storage + Edge Functions) with a React frontend, abstracting away the complexity of managing multiple AI providers and social media APIs behind a clean, team-friendly interface with transparent credit-based billing.

---

## 2. Problem Statement

Content teams face three compounding problems:

1. **Fragmented tooling.** Generating content (AI tools), scheduling it (social schedulers), and measuring results (analytics dashboards) requires three or more separate products with no shared context.
2. **Manual repetition.** Publishing the same content across Instagram, YouTube, LinkedIn, TikTok, Twitter, and Facebook requires manual effort for each platform, every time.
3. **Unpredictable AI costs.** Most AI generation tools charge per-call with no visibility into spend until the invoice arrives.

Creozel solves all three by combining AI generation, multi-platform publishing, automation pipelines, and usage-based credit billing into one product.

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
- Enable end-to-end content creation → scheduling → publishing → analytics in one product
- Support all major social platforms (Instagram, YouTube, Twitter/X, Facebook, LinkedIn, TikTok)
- Provide transparent, predictable credit-based billing with real-time balance visibility
- Support team collaboration with role-based access control
- Automate recurring content workflows via n8n-based pipelines
- Deliver AI-generated text, images, video, and audio from a unified interface

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
- Video scripts: OpenAI GPT-4
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
| Video Script | OpenAI GPT-4 | Structured script with scene breakdowns |
| Audio / TTS | ElevenLabs, Whisper | MP3 audio files |

**Generation Flow:**
1. User submits a prompt with content type, tone, and optional brand context
2. Frontend inserts a `content_jobs` row with `status: 'pending'` and reserves credits
3. A Supabase Edge Function (`/functions/v1/generate-content`) is invoked, calls the AI provider, and updates the job row
4. Frontend subscribes to `content_jobs` row changes via Realtime — no polling required
5. On completion, the generated asset is uploaded to Supabase Storage and the public URL is stored on the job row
6. Credits are deducted from the user's wallet on successful completion; reserved credits are released on failure

**Requirements:**
- Credit cost is estimated and displayed before generation begins
- Users can cancel in-progress jobs; reserved credits are released immediately
- Generated content is saved to the Media Library automatically
- Brand voice guidelines from the user's Brand Profile are injected into the Edge Function system prompt
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

**Publishing:**
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

**Description:** Visual workflow automation via n8n for recurring content tasks — e.g., "every Monday at 9am, generate a LinkedIn post about our latest product update and schedule it."

**Pipeline Components:**
- **Trigger:** Cron schedule or webhook (configured in n8n)
- **Steps:** Generate content (via Edge Function webhook) → optionally transform → publish to one or more platforms
- **Templates:** Reusable n8n workflow configurations

**Requirements:**
- Users create and manage pipelines via the embedded n8n interface or Creozel's pipeline UI
- Each pipeline execution is logged in a `pipeline_executions` table with status (`pending`, `running`, `completed`, `failed`) and duration
- The Workflow Dashboard shows real stats from the `pipeline_executions` table via PostgREST — no hardcoded values
- Stats displayed: active pipeline count, total executions, estimated time saved (hours), success rate
- Users can pause, resume, or delete pipelines
- Failed executions show the step that failed and the error message

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

**Description:** A wallet-based credit system where users purchase credit bundles and spend them on AI generation. Subscription plans determine the monthly credit allocation and feature access.

**Credit System:**
- Each user/team has a `wallets` row in PostgreSQL with a real-time balance
- Credits are reserved at job creation and deducted on completion (or released on failure) via database functions
- Transaction history is stored in a `credit_transactions` table with type labels: `purchase`, `deduction`, `refund`, `bonus`
- Credit cost per generation type is configurable in a `pricing_config` table

**Billing:**
- Subscription plans are managed via Stripe (global) and Razorpay (India)
- Stripe webhooks are handled by a Supabase Edge Function that updates the `subscriptions` table
- Plans include: Free, Starter, Pro, Agency
- Invoices are generated per billing cycle and downloadable as PDF
- Users can add/remove payment methods from the Billing settings page
- Overage beyond plan credits can be purchased as top-ups

---

### 6.8 Team Collaboration

**Description:** Multi-user workspaces where teams share content, pipelines, social connections, and analytics.

**Requirements:**
- A user can create or join multiple teams; they switch between teams via a workspace selector
- Team data is stored in a `teams` table; membership in `team_members` with role column
- Team owners can invite members by email; invitations stored in `team_invitations` and expire after 7 days
- Role changes take effect immediately (RLS policies re-evaluated on next request)
- All resources (posts, pipelines, media, analytics) are scoped to the active team via `team_id` foreign keys and RLS
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
| `media_items` | Media library index |
| `wallets` | Credit balances per user/team |
| `credit_transactions` | Credit debit/credit history |
| `pricing_config` | Credit cost per content type |
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
| **Pipeline** | An n8n workflow that automates recurring content generation and publishing |
| **ContentJob** | An async AI generation task tracked in the `content_jobs` table |
| **Wallet** | A user or team's credit balance stored in the `wallets` table |
| **Credit** | The unit of currency for AI generation; purchased in bundles or included in plans |
| **SocialConnection** | An OAuth-linked social platform account stored in `social_connections` |
| **BrandProfile** | A user's brand identity settings injected into AI generation prompts |
| **RLS** | Row Level Security — PostgreSQL policies enforced by Supabase on every query |
| **Edge Function** | A Deno serverless function deployed on Supabase, used for AI calls and webhooks |
| **GoTrue** | Supabase's authentication server handling JWT sessions |
| **PostgREST** | Supabase's auto-generated REST API layer over PostgreSQL |

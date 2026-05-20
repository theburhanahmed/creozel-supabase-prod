# Implementation Plan: Content Generation Studio

## Overview

This plan converts the Content Generation Studio design into incremental coding tasks. The implementation follows a strict dependency order: database migrations first, then TypeScript types, then services, then hooks, then components, and finally routing. Property-based tests (using fast-check) are placed immediately after the code they validate.

## Tasks

- [x] 1. Database Migrations
  - Description: Create the two new PostgreSQL tables (studio_templates and pipelines) with indexes, RLS policies, and triggers required by the Studio. These migrations must run before any frontend code references the tables.
  - Files: supabase/migrations/20260502000001_studio_templates.sql, supabase/migrations/20260502000002_pipelines.sql
  - Requirements: 8.2, 8.10, 12.4, 12.7, 16.6
  - Dependencies: none
  - Sub-tasks:
    - [x] 1.1 Create studio_templates table with id, name, description, content_category, content_format, platform, tone, prompt_template, advanced_options (JSONB), is_system, team_id, and created_at columns plus check constraints
    - [x] 1.2 Add indexes on studio_templates (team_id, content_category, content_format) and (is_system, content_category)
    - [x] 1.3 Enable RLS on studio_templates and add select policy (system templates readable by all authenticated users; team templates readable by team members), insert policy (team editors only), and delete policy (team editors only)
    - [x] 1.4 Create pipelines table with id, team_id, name, description, schedule, config (JSONB), created_at, updated_at columns plus unique(team_id, name) constraint and set_updated_at trigger
    - [x] 1.5 Add index on pipelines (team_id, created_at desc) and enable RLS with select (team members), insert (team editors), update (team editors), and delete (team admins) policies

- [x] 2. TypeScript Types
  - Description: Add all new domain types to frontend/src/types/index.ts. These types are the foundation for every subsequent task — hooks, services, and components all import from here.
  - Files: frontend/src/types/index.ts
  - Requirements: 3.1, 3.2, 4.1, 5.1, 6.1, 15.5, 17.1, 18.1, 18.2
  - Dependencies: none
  - Sub-tasks:
    - [x] 2.1 Add ContentCategory, ContentFormat (all 74 Phase 1 snake_case keys), StudioPlatform, StudioTone, and StudioMode union types
    - [x] 2.2 Add PlatformConstraints, ContentFormatRegistryEntry, and ContentFormatRegistry interfaces
    - [x] 2.3 Add LengthPreset, LengthConfig, StudioDraftConfig, and StudioValidationErrors interfaces
    - [x] 2.4 Add ContentFormatMetadataSchema interface with all fields (contentCategory, contentFormat, platform, tone, length, advancedOptions, platformConstraints, sourceJobId, sourceMediaId, repurposingInstructions, schemaVersion)
    - [x] 2.5 Add StudioTemplate, Pipeline, RepurposingSource, and RepurposingSourceType types
    - [x] 2.6 Run npx tsc --noEmit from frontend/ and confirm zero new type errors

- [x] 3. Content Format Registry Constant
  - Description: Create the CONTENT_FORMAT_REGISTRY constant covering all 74 Phase 1 ContentFormat values. This constant is the single source of truth for category membership, compatible platforms, and PlatformConstraints — it drives the entire Studio UI without any database round-trips.
  - Files: frontend/src/constants/contentFormatRegistry.ts
  - Requirements: 3.2, 3.3, 4.4, 4.5, 16.1, 16.2, 16.3
  - Dependencies: 2
  - Sub-tasks:
    - [x] 3.1 Define and export CONTENT_FORMAT_REGISTRY as a Record<ContentFormat, ContentFormatRegistryEntry> with entries for all 26 text formats (tweet, thread, caption, hook, cta, poll_text, quote_post, status_update, community_post, meme_text, story_text_overlay, product_announcement, blog_post, article, newsletter, seo_page, landing_page_copy, product_description, whitepaper, case_study, tutorial, guide, press_release, qa_post, ama_content, community_response)
    - [x] 3.2 Add entries for all 17 image formats (single_image_post, poster, ai_art, infographic, motivational_graphic, product_image, branded_creative, event_poster, announcement_banner, carousel, swipe_post, before_after_set, educational_slides, lookbook, ai_generated_image, meme, gif)
    - [x] 3.3 Add entries for all 17 video formats (reel, short, tiktok_video, vertical_video, promo_video, talking_head_video, loop_video, youtube_video, tutorial_video, product_demo, faceless_video, voiceover_video, subtitle_video, ai_explainer_video, repurposed_clip) and all 7 audio formats (podcast_episode, voiceover, tts_narration, audio_blog, voice_note, audio_ad, multilingual_dub)
    - [x] 3.4 Add entries for all 7 story formats (story_single, story_sequence, poll_story, quiz_story, countdown_story, link_story, product_story)
    - [x] 3.5 Populate PlatformConstraints for all format+platform combinations listed in Requirement 16.3 (tweet/Twitter, thread/Twitter, caption/Instagram, caption/LinkedIn, reel/Instagram, short/YouTube, tiktok_video/TikTok, carousel/Instagram, carousel/LinkedIn, single_image_post/Instagram, podcast_episode/Podcast, youtube_video/YouTube, story_single/Instagram)
    - [x] 3.6 Export CONTENT_CATEGORIES, CONTENT_FORMATS_PHASE1, STUDIO_PLATFORMS, and STUDIO_TONES as typed const arrays for use in PBT arbitraries

- [x] 4. PBT — Registry and Platform Filtering (Properties 1, 2, 3, 13)
  - Description: Write property-based tests using fast-check that validate the CONTENT_FORMAT_REGISTRY constant and platform filtering logic. These tests run immediately after the registry is created and before any UI code depends on it. Verify fast-check is in package.json; add it as a dev dependency if absent.
  - Files: frontend/src/__tests__/pbt/contentFormatRegistry.pbt.test.ts, frontend/src/__tests__/pbt/useContentFormats.pbt.test.ts, frontend/src/__tests__/pbt/platformFiltering.pbt.test.ts, frontend/src/__tests__/pbt/constraintHints.pbt.test.ts
  - Requirements: 3.2, 4.4, 4.5, 16.1, 16.2, 16.3
  - Dependencies: 3
  - Sub-tasks:
    - [x] 4.1 Write Property 1 (registry completeness): for every ContentFormat key in the union type, assert CONTENT_FORMAT_REGISTRY has a non-null entry with non-empty label, non-empty description, valid category, and non-empty compatiblePlatforms array (minimum 100 runs)
    - [x] 4.2 Write Property 2 (category-format membership): for any ContentCategory, every format returned by filtering the registry by that category must have registry[format].category === category and no format from another category appears (minimum 100 runs)
    - [x] 4.3 Write Property 3 (platform compatibility filtering): for any ContentFormat and StudioPlatform not in compatiblePlatforms, assert that platform does not appear in the availablePlatforms list derived from the registry (minimum 100 runs)
    - [x] 4.4 Write Property 13 (constraint hint accuracy): for every format+platform combination listed in Requirement 16.3, assert usePlatformConstraints returns a PlatformConstraints object whose fields exactly match the specified values (minimum 100 runs)
    - [x] 4.5 Run npx vitest --run src/__tests__/pbt/ and confirm all four property tests pass

- [x] 5. Service Layer
  - Description: Create studioService.ts (new file) and update contentService.ts. The service layer encapsulates all Supabase queries for templates, pipelines, repurposing sources, and recent jobs. All functions follow the existing error-handling pattern (catch (error: unknown), reportError, return null/[]/false on failure).
  - Files: frontend/src/services/studioService.ts, frontend/src/services/contentService.ts
  - Requirements: 8.3, 8.7, 8.8, 8.9, 12.4, 12.9, 13.1, 15.4, 17.2, 18.7
  - Dependencies: 2
  - Sub-tasks:
    - [x] 5.1 Implement getTemplates(teamId, filters): fetches system templates (is_system=true) and team templates (team_id=teamId) in a single .or() query; returns StudioTemplate[] or [] on error
    - [x] 5.2 Implement saveTemplate(teamId, config): inserts a new user-saved template row with is_system=false and team_id=teamId; returns the created StudioTemplate or null on error
    - [x] 5.3 Implement deleteTemplate(templateId): deletes the row by id; returns true on success, false on error
    - [x] 5.4 Implement savePipeline(teamId, config): inserts a new pipelines row; returns the created Pipeline or null on error; implement checkPipelineNameExists(teamId, name) to detect duplicates before insert
    - [x] 5.5 Implement getRepurposingSources(teamId, userId, limit?): fetches last 20 completed content_jobs and last 20 media_items in parallel via Promise.all, maps each to RepurposingSource with legacy contentFormat fallback per Requirement 18.7, returns combined array sorted by recency
    - [x] 5.6 Update contentService.ts: narrow CreateJobParams.metadata type from Record<string, unknown> to ContentFormatMetadataSchema; add optional teamId parameter to getRecentJobs that appends .eq("team_id", teamId) when provided

- [x] 6. Custom Hooks
  - Description: Implement all seven custom hooks that power the Studio. useStudioState is the master hook owning all form state and localStorage persistence. The remaining hooks are focused sub-hooks for derived data, async fetches, and Realtime subscriptions.
  - Files: frontend/src/hooks/useStudioState.ts, frontend/src/hooks/useContentFormats.ts, frontend/src/hooks/usePlatformConstraints.ts, frontend/src/hooks/useCreditEstimate.ts, frontend/src/hooks/useRepurposingSources.ts, frontend/src/hooks/useJobRealtime.ts, frontend/src/hooks/useTemplates.ts
  - Requirements: 3.5, 3.7, 3.8, 5.3, 7.7, 9.2, 9.3, 9.7, 10.4, 13.1, 14.1, 14.2, 14.3, 14.4, 14.5
  - Dependencies: 2, 3, 5
  - Sub-tasks:
    - [x] 6.1 Implement useStudioState(teamId): owns all form state (mode, prompt, contentCategory, contentFormat, platform, tone, length, advanced options, repurposing fields, activeJob, isGenerating, validationErrors); reads/writes {teamId}:studio:draftConfig from localStorage on mount and with 500 ms debounce on change; falls back to defaults for missing/invalid/Phase-2+ fields; implements buildMetadata(), validateBeforeGenerate(), applyTemplate(), reuseJobConfig(), and clearDraft()
    - [x] 6.2 Implement useContentFormats(category): returns array of [format, entry] pairs for the given category from CONTENT_FORMAT_REGISTRY, memoised with useMemo, sorted by label
32  - Description: Extract StatusBadge and ResultViewer from ContentHub into standalone files under src/components/content/. These shared components are used by both the new Studio and the existing ContentHub, so they must be extracted before any Studio output components are built.
  - Files: frontend/src/components/content/StatusBadge.tsx, frontend/src/components/content/ResultViewer.tsx
  - Requirements: 11.1, 11.2, 11.3, 11.4, 15.1, 15.5
  - Dependencies: 2
  - Sub-tasks:
    - [x] 8.1 Extract StatusBadge from ContentHub into src/components/content/StatusBadge.tsx; accept a status prop typed as ContentJob["status"]; render a styled badge for pending, running, completed, failed, and cancelled states; add aria-label for accessibility
    - [x] 8.2 Extract ResultViewer from ContentHub into src/components/content/ResultViewer.tsx; split into TextResultViewer (renders fetched text inline), ImageResultViewer (renders img with descriptive alt), AudioResultViewer (renders audio element with native controls), and VideoResultViewer (renders fetched script text with video label)
    - [x] 8.3 Add a 10-second timeout to the result_url fetch in TextResultViewer and VideoResultViewer; on timeout or fetch failure display an error message and a fallback link to result_url
    - [x] 8.4 Update ContentHub.tsx to import StatusBadge and ResultViewer from their new paths instead of defining them inline; verify ContentHub still renders correctly
    - [x] 8.5 Run npx tsc --noEmit and confirm zero new type errors

- [x] 9. Core Studio UI Components (Layout, Header, Mode Toggle, Category Tabs, Format Grid, Prompt Input)
  - Description: Build the structural and primary input components of the Studio. These form the skeleton of the Configuration Panel and must be in place before the secondary controls (platform, tone, length) are added.
  - Files: frontend/src/components/content/studio/StudioHeader.tsx, frontend/src/components/content/studio/StudioLayout.tsx, frontend/src/components/content/studio/StudioModeToggle.tsx, frontend/src/components/content/studio/ConfigurationPanel.tsx, frontend/src/components/content/studio/ContentCategoryTabs.tsx, frontend/src/components/content/studio/ContentFormatGrid.tsx, frontend/src/components/content/studio/FormatCard.tsx, frontend/src/components/content/studio/PromptInput.tsx
  - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 15.1, 15.2
  - Dependencies: 2, 3, 6, 8
  - Sub-tasks:
    - [x] 9.1 Implement StudioHeader (displays team name from props, breadcrumb) and StudioLayout (two-panel responsive wrapper: side-by-side at >= 1024 px, stacked below; each panel min-width 300 px; accepts configPanel and outputPanel ReactNode props)
    - [x] 9.2 Implement StudioModeToggle as a segmented control with "Create" and "Repurpose" options; accepts mode and onChange props; apply visible selected-state indicator; keyboard accessible
    - [x] 9.3 Implement ContentCategoryTabs: render five tabs (Text, Image, Video, Audio, Story) each with a unique icon and accent colour; display credit cost per category from creditsByCategory prop; show "?" when creditsUnavailable is true; apply visible selected-state indicator on active tab
    - [x] 9.4 Implement ContentFormatGrid and FormatCard: grid renders all Phase 1 formats for the selected category using useContentFormats; each FormatCard shows label, description, and compatible platform tags; apply selected-state border highlight; keyboard accessible via onClick
    - [x] 9.5 Implement PromptInput: multi-line textarea with minimum 5 visible rows and user-resizable height; live character count display in {current}/{max} format updating on every keystroke; show inline validation error when error prop is set; show visible warning and disable Generate when length > 4000; update placeholder text when contentCategory changes
    - [x] 9.6 Implement NoTeamEmptyState component: shown when activeTeam is null; displays explanatory message and CTA button navigating to team management; prevents Configuration Panel from rendering

- [x] 10. Platform, Tone, Length, and Advanced Options Components
  - Description: Build the secondary configuration controls. PlatformSelector and PlatformConstraintHint implement the format-driven platform filtering and constraint display. ToneSelector, LengthSelector, and AdvancedOptionsPanel are refactored from ContentHub to accept props instead of owning state.
  - Files: frontend/src/components/content/studio/PlatformSelector.tsx, frontend/src/components/content/studio/PlatformConstraintHint.tsx, frontend/src/components/content/studio/ToneSelector.tsx, frontend/src/components/content/studio/LengthSelector.tsx, frontend/src/components/content/studio/AdvancedOptionsPanel.tsx
  - Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 15.1, 15.2
  - Dependencies: 2, 3, 6, 9
  - Sub-tasks:
    - [x] 10.1 Implement PlatformSelector: renders 10 platform options filtered to availablePlatforms prop; defaults to General when current selection is not in the compatible set; applies visible selected-state indicator; all options have aria-label; keyboard accessible
    - [x] 10.2 Implement PlatformConstraintHint: reads constraints from usePlatformConstraints; displays character limit, aspect ratio, duration limit, and file format as inline hints adjacent to the platform selector; shows "No specific constraints for this combination" when constraints is null
    - [x] 10.3 Implement ToneSelector: renders exactly six tone options (Professional, Casual, Humorous, Inspirational, Persuasive, Informative); defaults to Professional; shows "Brand voice active" notice when brandVoiceActive prop is true and brand voice guidelines are non-null; persists selection via useStudioState
    - [x] 10.4 Implement LengthSelector: renders per-category controls (text: Short/Medium/Long/Custom presets with custom min/max word count inputs; video: Short/Medium/Long scene count; image: quantity 1-4 and resolution selector; audio: speaking rate slider 0.5x-2.0x step 0.25x); shows inline validation error when maxWords < minWords; defaults per Requirement 6.7
    - [x] 10.5 Implement AdvancedOptionsPanel: collapsible panel defaulting to collapsed; renders TextAdvancedOptions, ImageAdvancedOptions, VideoAdvancedOptions, or AudioAdvancedOptions sub-panels based on category prop; AudioAdvancedOptions shows "Failed to load voices" with retry button when voicesFailed is true; all sub-panels receive options and onChange props (no internal state)
    - [x] 10.6 Run npx tsc --noEmit and confirm zero new type errors introduced by these components

- [x] 11. Credit Estimate Bar, Studio Actions, and Save as Pipeline Modal
  - Description: Build the bottom bar of the Configuration Panel. CreditEstimateBar shows the real-time cost estimate and current balance. StudioActions renders the Generate and Save as Pipeline buttons with all gate conditions. SaveAsPipelineModal collects pipeline name, description, and schedule.
  - Files: frontend/src/components/content/studio/CreditEstimateBar.tsx, frontend/src/components/content/studio/StudioActions.tsx, frontend/src/components/content/studio/SaveAsPipelineModal.tsx
  - Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.1, 10.2, 10.7, 10.9, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.8, 12.9, 15.1, 15.2
  - Dependencies: 2, 5, 6, 9, 10
  - Sub-tasks:
    - [x] 11.1 Implement CreditEstimateBar: displays estimated cost to two decimal places (e.g., "3.50 credits"); shows loading indicator while isLoading is true; shows "Cost estimate unavailable" when isUnavailable is true; displays current balance in "{balance} credits available" format; shows inline warning and "Top Up Credits" link when estimatedCost > balance
    - [x] 11.2 Implement StudioActions: renders Generate button (disabled when canGenerate is false or isGenerating is true; shows loading indicator during generation) and Save as Pipeline button side by side; Generate button activatable via Enter key
    - [x] 11.3 Implement SaveAsPipelineModal: collects pipeline name (required, max 100 chars with inline validation), optional description (max 500 chars), and optional cron schedule free-text input; updates human-readable schedule preview within 500 ms of cron input change
    - [x] 11.4 Wire SaveAsPipelineModal submit to studioService.savePipeline; on success show success toast and close modal; on failure show error toast and keep modal open with all values preserved; on duplicate name show inline error in name field without submitting
    - [x] 11.5 Connect CreditEstimateBar and StudioActions to useCreditEstimate and useStudioState; ensure Generate button is disabled while credit estimate is loading (Requirement 9.7)

- [x] 12. Template Library Components
  - Description: Build the Template Library section of the Configuration Panel. TemplateLibrary, TemplateFilters, TemplateGrid, TemplateCard, and SaveAsTemplateModal together implement browsing, filtering, applying, saving, and deleting templates.
  - Files: frontend/src/components/content/studio/TemplateLibrary.tsx, frontend/src/components/content/studio/TemplateFilters.tsx, frontend/src/components/content/studio/TemplateGrid.tsx, frontend/src/components/content/studio/TemplateCard.tsx, frontend/src/components/content/studio/SaveAsTemplateModal.tsx
  - Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 15.1, 15.2
  - Dependencies: 2, 5, 6, 9
  - Sub-tasks:
    - [x] 12.1 Implement TemplateFilters: renders category filter (all + 5 categories) and platform filter (all + 10 platforms) as select or button-group controls; calls onCategoryChange and onPlatformChange on change
    - [x] 12.2 Implement TemplateGrid and TemplateCard: grid renders filtered templates from useTemplates; each card shows name, description, content category, and platform; user-saved templates show a delete button; clicking a card calls onApply; empty state message when no templates match filters
    - [x] 12.3 Wire TemplateCard delete button: show confirmation prompt on click; on confirm call studioService.deleteTemplate and remove card from grid; on cancel dismiss prompt with no changes
    - [x] 12.4 Implement SaveAsTemplateModal: collects template name (required, 1-100 chars) and description (optional, 0-500 chars) with inline validation errors; on submit calls studioService.saveTemplate with current config; on success show toast and close modal; on failure show error toast and keep modal open
    - [x] 12.5 Wire template application: when a template card is clicked, call useStudioState.applyTemplate(template) to overwrite prompt, contentCategory, contentFormat, platform, tone, and advanced options; show toast notification with template name that auto-dismisses after 3-5 seconds
    - [x] 12.6 Implement TemplateLibrary as the container: renders TemplateFilters above TemplateGrid; includes Save as Template button that opens SaveAsTemplateModal; passes teamId and onApply down to sub-components


- [x] 13. Output Panel and Recent Jobs Panel
  - Description: Build the right-hand Output Panel and the Recent Jobs section. The Output Panel displays job status, renders generated content by type, and provides Copy/Download/Publish/Regenerate actions. RecentJobsPanel shows the last 10 jobs with Re-use Config support.
  - Files: frontend/src/components/content/studio/OutputPanel.tsx, frontend/src/components/content/studio/RecentJobsPanel.tsx, frontend/src/components/content/studio/RecentJobCard.tsx, frontend/src/components/content/studio/OutputActions.tsx, frontend/src/components/content/studio/JobStatusDisplay.tsx
  - Requirements: 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 15.1, 15.2
  - Dependencies: 2, 6, 8
  - Sub-tasks:
    - [x] 13.1 Implement JobStatusDisplay: renders StatusBadge for the current job status (pending, running, completed, failed, cancelled); shows a progress indicator while status is pending or running
    - [x] 13.2 Implement OutputPanel: renders JobStatusDisplay at top; delegates content rendering to the appropriate ResultViewer sub-component based on job type; shows loading indicator while fetching inline text content; disables Copy, Download, and Publish buttons when job status is not completed or while fetching
    - [x] 13.3 Implement OutputActions: Copy button (text/video jobs only) copies fetched text to clipboard; on success shows "Copied!" confirmation for 2-5 seconds; on failure shows inline error; Download button initiates file download from result_url; Publish button navigates to Calendar page with content pre-filled; Regenerate button resets active job and re-enables Generate with same config
    - [x] 13.4 Implement RecentJobCard: displays content type icon, prompt excerpt (first 80 chars + ellipsis), StatusBadge, relative timestamp (e.g., "2 hours ago"), and credit cost in "{cost} credits" format; shows Re-use Config button for completed jobs; clicking the card loads the job result into the Output Panel
    - [x] 13.5 Implement RecentJobsPanel: fetches last 10 content_jobs for the active team via contentService.getRecentJobs with teamId; renders RecentJobCard list; shows "Failed to load recent jobs" error state; refreshes automatically when a new job completes or is cancelled via the existing Realtime subscription
    - [x] 13.6 Wire Re-use Config: when clicked on a RecentJobCard, call useStudioState.reuseJobConfig(job) to pre-fill prompt and all metadata fields; apply legacy contentFormat fallback per Requirement 18.7 when contentFormat is absent from job metadata

- [x] 14. Repurposing Engine Components
  - Description: Build the Repurpose Content mode of the Configuration Panel. RepurposingSourcePicker lets users select a source from Recent Jobs or Media Library. SourceAssetPreview shows a preview of the selected source. RepurposingTargetSelector shows valid target formats. RepurposingInstructionsInput collects supplementary instructions.
  - Files: frontend/src/components/content/studio/RepurposingSourcePicker.tsx, frontend/src/components/content/studio/SourceAssetPreview.tsx, frontend/src/components/content/studio/RepurposingTargetSelector.tsx, frontend/src/components/content/studio/RepurposingInstructionsInput.tsx
  - Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.7, 17.9, 17.10, 15.1, 15.2
  - Dependencies: 2, 3, 5, 6, 9
  - Sub-tasks:
    - [x] 14.1 Implement RepurposingSourcePicker: renders a tab bar with "Recent Jobs" and "Media Library" tabs; Recent Jobs tab shows SourceJobList (completed jobs from useRepurposingSources); Media Library tab shows SourceMediaGrid (media items from useRepurposingSources); shows empty state when no sources exist; shows error message when sources fetch fails
    - [x] 14.2 Implement SourceAssetPreview: when a source is selected, displays format label, platform, and a preview (text excerpt up to 300 chars for text assets; thumbnail image for image/video assets; waveform placeholder for audio assets; fallback "Untitled" label when asset has no name)
    - [x] 14.3 Implement RepurposingTargetSelector: derives valid target formats from the source asset's format using the repurposing paths defined in Requirement 17.4; renders a filtered ContentFormat grid showing only valid targets; no format outside the valid paths is selectable
    - [x] 14.4 Implement RepurposingInstructionsInput: optional textarea for supplementary repurposing instructions (max 1000 characters); stores value in useStudioState.repurposingInstructions; shows live character count
    - [x] 14.5 Wire Repurpose mode: when mode is "repurpose", ConfigurationPanel renders RepurposingSourcePicker, SourceAssetPreview, RepurposingTargetSelector, RepurposingInstructionsInput, PlatformSelector, and ToneSelector; Generate button creates a RepurposingJob with metadata.sourceJobId or metadata.sourceMediaId populated alongside standard ContentFormatMetadataSchema fields

- [x] 15. ContentGenerationStudio Page and Routing
  - Description: Assemble all components into the ContentGenerationStudio page component and update App.tsx routing. This is the final frontend assembly task — it wires useStudioState to all child components and handles the Generate action end-to-end.
  - Files: frontend/src/pages/content/ContentGenerationStudio.tsx, frontend/src/App.tsx
  - Requirements: 1.1, 1.4, 1.5, 1.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 14.1, 14.2, 14.3, 14.4, 14.5, 15.3, 15.6
  - Dependencies: 2, 5, 6, 8, 9, 10, 11, 12, 13, 14
  - Sub-tasks:
    - [x] 15.1 Implement ContentGenerationStudio: reads user and activeTeam from useAppContext(); renders NoTeamEmptyState when activeTeam is null; renders StudioHeader with team name; renders StudioLayout with ConfigurationPanel and OutputPanel
    - [x] 15.2 Wire ConfigurationPanel: passes all state and setters from useStudioState to StudioModeToggle, ContentCategoryTabs, ContentFormatGrid, PromptInput, PlatformSelector, ToneSelector, LengthSelector, AdvancedOptionsPanel, CreditEstimateBar, StudioActions, and TemplateLibrary```````
        - [x] 15.3 Implement Generate action handler in ContentGenerationStudio: calls validateBeforeGenerate(); on failure shows inline validation errors; on success calls contentService.createContentJob with buildMetadata() output; sets activeJob; subscribes to job updates via useJobRealtime; on job complete calls clearDraft() and triggers media save flow; on media save failure shows non-blocking warning toast
    - [x] 15.4 Implement Cancel action: renders Cancel button while job is pending or running; calls contentService.cancelJob; on success updates Output Panel to cancelled status; on failure shows error toast and leaves job status unchanged
    - [x] 15.5 Update App.tsx: replace the ContentHub lazy import with a lazy import of ContentGenerationStudio from ./pages/content/ContentGenerationStudio; update the <Route path="/content/*"> element to render <ContentGenerationStudio />; leave ContentHub.tsx file in place (do not delete)
    - [x] 15.6 Run npx tsc --noEmit from frontend/ and confirm zero type errors; run npx vitest --run and confirm all tests pass

- [ ] 16. Edge Function Updates
  - Description: Update the generate-content Supabase Edge Function to validate the new metadata schema, route jobs to the correct AI provider via FORMAT_PROVIDER_MAP, detect and handle repurposing jobs by fetching source content, and apply schema version handling for backward compatibility with legacy jobs.
  - Files: supabase/functions/generate-content/index.ts
  - Requirements: 10.3, 17.6, 17.8, 18.4, 18.5, 18.6
  - Dependencies: 1, 2
  - Sub-tasks:
    - [x] 16.1 Add metadata schema validation at the top of the handler: after fetching the job, check that metadata.contentCategory and metadata.contentFormat are both present and non-null; if either is absent, update job status to failed with error_message "Invalid metadata: contentCategory and contentFormat are required." and return 400 without processing further
    - [x] 16.2 Define FORMAT_PROVIDER_MAP at module scope as a Record<string, FormatProviderConfig> mapping all 74 Phase 1 ContentFormat keys to their provider (openai_text, openai_image, elevenlabs, or replicate) and optional promptTemplate prefix; replace the existing if/else chain with a lookup: const formatConfig = FORMAT_PROVIDER_MAP[contentFormat] ?? FORMAT_PROVIDER_MAP[job.type]
    - [x] 16.3 Add schema version handling: read metadata.schemaVersion (default "0" for legacy jobs); for schemaVersion "0" preserve the existing provider-selection logic unchanged; for schemaVersion "1" use FORMAT_PROVIDER_MAP[contentFormat] for routing
    - [x] 16.4 Add repurposing source detection: after schema validation, check for metadata.sourceJobId and metadata.sourceMediaId; if sourceJobId is present, fetch the source content_jobs row and its result_url content; if the source row does not exist, fail the job with "Source content is no longer available."; if the source content fetch fails, fail the job with "Failed to fetch source content."; inject sourceContent into the AI system prompt when non-null
    - [x] 16.5 Handle metadata.sourceMediaId: if present, fetch the media_items row; if not found, fail the job with "Source content is no longer available."; inject the media public_url as context in the system prompt; read metadata.repurposingInstructions and append to the system prompt when non-null
    - [ ] 16.6 Verify all new error paths call the existing credit-release logic before returning; deploy the updated Edge Function and confirm it processes a test job with schemaVersion "1" metadata without errors

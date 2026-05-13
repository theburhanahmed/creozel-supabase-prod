# Requirements Document

## Introduction

This document defines the requirements for the **Content Generation Studio** — the primary content creation interface for Creozel. The Studio is a dedicated, full-featured workspace that replaces the existing `ContentHub` stub with a polished, creator-focused experience. It allows any type of content creator (social media, blog, video scripts, newsletters, podcasts, etc.) to:

1. Describe what they want via a free-text prompt
2. Configure generation options (content category, content format, tone, platform, length, and more)
3. Browse and apply pre-built templates to jumpstart creation
4. Click **Generate** to produce AI-powered content via the existing Edge Function pipeline
5. Click **Save as Pipeline** to persist the current configuration as a reusable automation pipeline
6. Repurpose existing content into new formats and platforms via the Repurposing Engine

The Studio builds on top of the existing `content_jobs`, `wallets`, `brand_profiles`, `pricing_config`, and `pipeline_executions` tables already defined in `mvp-database-schema`. It does not replace the generation pipeline itself (covered by `mvp-content-generation`); it provides the creator-facing UI layer that drives that pipeline.

### Phased Delivery Strategy

This spec covers **Phase 1 — Core Revenue Engine** only. The content type taxonomy, data model, and Edge Function metadata schema are designed to be forward-compatible with future phases so that no breaking migrations are required.

- **Phase 2 — Differentiation (future spec):** AI avatars, AI voice clones, story automation, content pipelines, auto trend analysis, engagement AI, AI suggestions.
- **Phase 3 — Enterprise (future spec):** Team collaboration, approval workflows, white-label SDK, advanced analytics, API ecosystem.
- **Phase 4 — Dominance (future spec):** AI agents, autonomous growth systems, social commerce, interactive content, live AI streaming, AI influencer system.

Phase 2–4 content types and capabilities MUST NOT be implemented in this spec. The `content_jobs.metadata` schema and the ContentFormat taxonomy defined here MUST be extensible to accommodate them without destructive changes.

---

## Glossary

- **Studio**: The Content Generation Studio page rendered at `/content/studio`, the primary subject of this spec.
- **ContentJob**: An asynchronous AI generation task tracked in the `content_jobs` table, as defined in `mvp-content-generation`.
- **ContentCategory**: The top-level classification of generated content. One of `text`, `image`, `video`, `audio`, or `story`. Replaces the former flat `ContentType` field as the first level of the two-level taxonomy.
- **ContentFormat**: The specific format within a `ContentCategory` (e.g., `tweet`, `carousel`, `reel`, `ai_image`, `tts_voiceover`). Together with `ContentCategory`, it forms the two-level content type taxonomy used throughout the Studio and in `content_jobs.metadata`.
- **ContentType**: Deprecated alias for `ContentCategory`. Retained in existing code references for backward compatibility; new code MUST use `ContentCategory` and `ContentFormat`.
- **Platform**: The target social or publishing destination for the generated content (e.g., Instagram, LinkedIn, YouTube, Blog, Newsletter, TikTok, Twitter/X, Facebook, Podcast).
- **PlatformConstraints**: The set of platform-native formatting rules for a given `ContentFormat` + `Platform` combination, including character limits, aspect ratios, duration limits, and accepted file formats.
- **Tone**: The stylistic register of the generated content (e.g., Professional, Casual, Humorous, Inspirational, Persuasive, Informative).
- **Template**: A pre-built configuration record stored in the `studio_templates` table, containing a preset prompt, content category, content format, platform, tone, length, and advanced options.
- **Pipeline**: An automation workflow record stored in the `pipelines` table (n8n-backed), representing a saved Studio configuration that can be triggered on a schedule or manually.
- **PipelineConfig**: The serialised set of Studio form values (prompt, content category, content format, platform, tone, length, advanced options) that is persisted when the user clicks "Save as Pipeline".
- **CreditEstimate**: The real-time credit cost preview computed from the `pricing_config` table based on the currently selected content category, content format, and advanced options.
- **BrandProfile**: A row in the `brand_profiles` table containing `voice_guidelines` and `tone_settings` for the active team, injected into AI prompts when the brand voice toggle is enabled.
- **AdvancedOptions**: The per-content-category configuration panel (model, resolution, voice, etc.) already defined in `mvp-saas-platform` Requirement 6 and implemented in `ContentHub`.
- **OutputPanel**: The right-hand panel of the Studio that displays the active job's status, result, and post-generation actions.
- **TemplateLibrary**: The browsable, filterable collection of pre-built templates surfaced in the Studio.
- **SaveAsPipelineModal**: The modal dialog that collects a pipeline name and schedule before persisting the current Studio configuration.
- **RepurposingEngine**: The Studio subsystem that allows a user to select an existing piece of content (from Recent Jobs or the Media Library) and transform it into a different `ContentFormat` or target `Platform`.
- **RepurposingJob**: A `ContentJob` whose `metadata` includes a `sourceJobId` or `sourceMediaId` field, indicating that the generation is derived from an existing asset rather than a net-new prompt.
- **ContentFormatMetadataSchema**: The structured JSONB schema carried in `content_jobs.metadata`, containing `contentCategory`, `contentFormat`, `platform`, `tone`, `length`, `advancedOptions`, `platformConstraints`, and optional repurposing fields.
- **studio_templates**: A new PostgreSQL table storing pre-built and user-saved templates.
- **pipelines**: The existing or new PostgreSQL table storing saved pipeline configurations.
- **Realtime**: Supabase Realtime WebSocket subscriptions used to push `content_jobs` row changes to the Studio without polling.
- **Phase 1 Formats**: The complete set of `ContentFormat` values that are in scope for this spec, as enumerated in Requirement 16.
- **Phase Gate**: An architectural boundary that prevents Phase 2–4 `ContentFormat` values from being selectable in the Studio UI while keeping the data model extensible for future phases.

---

## Requirements

### Requirement 1 — Studio Page and Layout

**User Story:** As a content creator, I want a dedicated Studio page with a clear, focused layout, so that I can generate content without distraction and find all controls in one place.

#### Acceptance Criteria

1. THE Studio SHALL be rendered at the route `/content/studio` and SHALL be accessible from the main navigation "Create" item.
2. THE Studio layout SHALL consist of two primary panels: a **Configuration Panel** on the left (or top on mobile) containing all input controls, and an **Output Panel** on the right (or bottom on mobile) displaying job status and results. Each panel SHALL have a minimum rendered width of 300 px when the viewport is at or above 1024 px.
3. WHEN the viewport width is below 1024 px, THE Studio SHALL stack the Configuration Panel above the Output Panel in a single-column layout.
4. THE Studio SHALL display the active team name in the page header so the user can confirm which workspace they are generating content for.
5. WHEN `activeTeam` is `null`, THE Studio SHALL display an empty state with a message explaining that a team is required and a call-to-action button that navigates to the team management page, and SHALL NOT render the Configuration Panel or the generation form.
6. THE Studio page SHALL render the Studio component directly at the existing `/content` route (no redirect) as well as at `/content/studio`, so that the existing "Create" nav link continues to work without a redirect.

---

### Requirement 2 — Prompt Input

**User Story:** As a content creator, I want a prominent, multi-line prompt input with contextual placeholder text, so that I can clearly describe the content I want to generate.

#### Acceptance Criteria

1. THE Studio SHALL render a multi-line `<textarea>` prompt input with a minimum visible height of 5 rows and SHALL allow vertical resizing by the user.
2. WHEN the selected `ContentType` changes, THE Studio SHALL update the placeholder text of the prompt input to a contextually relevant example specific to that content type (e.g., "Describe the scene you want to illustrate…" for `image`, "Write a script for a 60-second explainer…" for `video`).
3. THE Studio SHALL display a live character count in the format `{current}/{max}` (e.g., `142/4000`) below the prompt input, updating on every keystroke.
4. WHEN the prompt input is empty and the user clicks "Generate", THE Studio SHALL display an inline validation message directly below the prompt input and SHALL NOT submit a generation job.
5. WHEN the prompt length exceeds 4,000 characters, THE Studio SHALL display a visible warning message adjacent to the character count and SHALL disable the "Generate" button.
6. WHEN the prompt length is reduced to 4,000 characters or fewer after having exceeded the limit, THE Studio SHALL remove the warning message and re-enable the "Generate" button (subject to all other validation conditions being met).

---

### Requirement 3 — Content Type Selector

**User Story:** As a content creator, I want to select the category and specific format of content I want to generate, so that the Studio routes my request to the correct AI provider and applies the right platform constraints.

#### Acceptance Criteria

1. THE Studio SHALL render a two-level content type selector. The first level SHALL present five `ContentCategory` options: **Text**, **Image**, **Video**, **Audio**, and **Story**. Each category option SHALL be displayed with a unique icon and a unique background or accent colour not shared with any other category option.
2. WHEN a `ContentCategory` is selected, THE Studio SHALL render a second-level `ContentFormat` selector displaying only the Phase 1 formats that belong to that category, as enumerated in Requirement 16. Each format option SHALL be displayed with a label and a brief description (e.g., "Reel — vertical short-form video up to 90 seconds").
3. WHEN a `ContentFormat` is selected, THE Studio SHALL update the credit cost estimate, the advanced options panel, the platform selector (applying format-specific platform restrictions per Requirement 4), and the prompt placeholder to reflect the selected format.
4. THE Studio SHALL display the credit cost for each `ContentCategory` option. IF the pricing data fetch fails or times out after 5 seconds, THEN THE Studio SHALL display `"?"` in place of the credit cost for each affected option.
5. WHEN the Studio page loads, THE Studio SHALL default to the `text` category and the `short_form_post` format if no previously persisted selection exists for the active team.
6. WHEN a `ContentCategory` or `ContentFormat` option is selected, THE Studio SHALL apply a visible selected-state indicator (e.g., border highlight or filled background) to that option and remove it from all other options at the same level.
7. THE Studio SHALL persist the selected `ContentCategory` and `ContentFormat` together in `localStorage` under the key `{team_id}:studio:draftConfig` and SHALL restore both on next load.
8. THE Studio SHALL NOT render any `ContentFormat` that belongs exclusively to Phase 2, 3, or 4 (as defined in the Introduction). IF a stored `draftConfig` references a Phase 2–4 format, THE Studio SHALL fall back to the default `text` / `short_form_post` selection.

---

### Requirement 4 — Platform Selector

**User Story:** As a content creator, I want to select the target platform for my content, so that the AI can tailor the format, length, and style to that platform's conventions and the Studio enforces native constraints before generation.

#### Acceptance Criteria

1. THE Studio SHALL render a platform selector with the following options: **Instagram**, **LinkedIn**, **Twitter / X**, **Facebook**, **YouTube**, **TikTok**, **Blog**, **Newsletter**, **Podcast**, and **General**.
2. WHEN a platform is selected, THE Studio SHALL include the platform name in the generation prompt metadata sent to the Edge Function so that the AI can apply platform-specific formatting conventions.
3. THE Studio SHALL default to **General** on first load when no previously persisted platform selection exists for the active team.
4. WHEN a `ContentFormat` is selected, THE Studio SHALL restrict the platform selector to only the platforms that are compatible with that format, as defined in the `PlatformConstraints` mapping in Requirement 16. IF the currently selected platform is not in the compatible set, THEN THE Studio SHALL automatically change the selected platform to **General**.
5. WHEN a platform is selected and the active `ContentFormat` has a defined `PlatformConstraints` entry for that platform, THE Studio SHALL display the applicable constraints as an inline hint adjacent to the platform selector (e.g., "Max 2,200 characters · 1:1 or 4:5 aspect ratio" for Instagram carousel).
6. WHEN the selected `ContentCategory` is `audio`, THE Studio SHALL restrict the platform selector to **Podcast**, **General**, and **YouTube**. IF the currently selected platform is not in this set, THEN THE Studio SHALL automatically change the selected platform to **General**.
7. WHEN the selected `ContentCategory` is `image`, THE Studio SHALL restrict the platform selector to **Instagram**, **Facebook**, **Twitter / X**, **LinkedIn**, and **General**. IF the currently selected platform is not in this set, THEN THE Studio SHALL automatically change the selected platform to **General**.
8. WHEN the selected `ContentCategory` changes to `text`, `video`, or `story` from a previously restricted category, THE Studio SHALL restore all 10 platform options in the selector.
9. THE Studio SHALL enforce `PlatformConstraints` in the UI before the user clicks "Generate": WHEN a constraint is violated (e.g., prompt-derived character count exceeds the platform limit for the selected format), THE Studio SHALL display an inline warning identifying the violated constraint and SHALL disable the "Generate" button until the violation is resolved.

---

### Requirement 5 — Tone Selector

**User Story:** As a content creator, I want to choose the tone of my content, so that the generated output matches the voice I want to project to my audience.

#### Acceptance Criteria

1. WHEN the Studio renders, THE Studio SHALL display a tone selector containing exactly six options: **Professional**, **Casual**, **Humorous**, **Inspirational**, **Persuasive**, and **Informative**.
2. WHEN the Studio loads and no previously persisted tone selection exists for the active team, THE Studio SHALL default the tone selector to **Professional**.
3. THE Studio SHALL persist the selected tone to `localStorage` under the key `{team_id}:studio:draftConfig` whenever the tone selection changes, and SHALL restore it on next load.
4. WHEN the brand voice toggle is enabled and the active team's `brand_profiles.voice_guidelines` is non-null, THE Studio SHALL display an inline notice immediately adjacent to the tone selector reading "Brand voice active — tone setting overridden" (or equivalent wording).
5. IF the active team's `brand_profiles.voice_guidelines` is `null` or the `brand_profiles` fetch fails, THEN THE Studio SHALL NOT display the brand voice override notice, regardless of the brand voice toggle state.

---

### Requirement 6 — Length / Output Size Selector

**User Story:** As a content creator, I want to specify the desired length or size of the generated output, so that I get content that fits my intended use without manual trimming.

#### Acceptance Criteria

1. WHEN the selected `ContentType` is `text`, THE Studio SHALL render a length selector with the following options: **Short** (up to 150 words), **Medium** (150–500 words), **Long** (500–1,500 words), and **Custom** (user-specified word count range).
2. WHEN **Custom** is selected for `text`, THE Studio SHALL render a minimum word count input (integer, 1–10,000) and a maximum word count input (integer, 1–10,000). IF the user submits with a maximum value less than the minimum value, THEN THE Studio SHALL display an inline validation error and SHALL NOT submit a generation job.
3. WHEN the selected `ContentType` is `video`, THE Studio SHALL render a duration selector with options: **Short** (1–3 scenes), **Medium** (4–6 scenes), and **Long** (7–10 scenes).
4. WHEN the selected `ContentType` is `image`, THE Studio SHALL render a quantity selector (1–4 images) and a resolution selector (512×512, 1024×1024, 1792×1024, 1024×1792).
5. WHEN the selected `ContentType` is `audio`, THE Studio SHALL render a speaking rate slider (0.5×–2.0×) with a step increment of 0.25× as the primary length/pace control.
6. WHEN the length selection changes, IF the `pricing_config` table defines length-based pricing tiers, THEN THE Studio SHALL update the credit cost estimate within 500 ms of the change.
7. WHEN the Studio loads for a given content type, THE Studio SHALL default the length selector to **Medium** for `text`, **Medium** for `video`, quantity **1** and resolution **1024×1024** for `image`, and speaking rate **1.0×** for `audio`, unless a previously persisted selection exists.

---

### Requirement 7 — Advanced Options Panel

**User Story:** As a power user, I want access to advanced AI configuration options, so that I have full control over the generation output without needing a separate tool.

#### Acceptance Criteria

1. THE Studio SHALL render a collapsible **Advanced Options** panel below the primary controls for each content type, defaulting to collapsed.
2. WHEN the `text` content type is selected, THE Advanced Options panel SHALL expose: AI model selector (GPT-4, GPT-3.5), output format selector (Blog Post, Caption, Ad Copy, Thread, Email), language input (free text, max 50 characters), and a brand voice toggle.
3. WHEN the `image` content type is selected, THE Advanced Options panel SHALL expose: AI provider selector (DALL-E 3, Stable Diffusion), style selector (Photorealistic, Illustration, Digital Art, Oil Painting, Watercolor), negative prompt input (max 500 characters), and a seed integer input (0–2,147,483,647).
4. WHEN the `video` content type is selected, THE Advanced Options panel SHALL expose: AI model selector (GPT-4, GPT-3.5), aspect ratio selector (16:9, 9:16, 1:1), include B-roll suggestions toggle, and a brand voice toggle.
5. WHEN the `audio` content type is selected, THE Advanced Options panel SHALL expose: TTS provider selector (ElevenLabs, Whisper), voice selector (populated from the selected provider), pitch adjustment slider (−10 to +10 semitones, default 0), stability/clarity slider (0–100, default 50, visible only when ElevenLabs is selected), and output format selector (MP3, WAV).
6. IF the voice list fetch for the `audio` content type fails or does not respond within 10 seconds, THEN THE voice selector SHALL display a "Failed to load voices" message and a retry button, and SHALL be disabled until a retry succeeds.
7. THE Advanced Options state for each content type SHALL be persisted in `localStorage` keyed by `{team_id}:{content_type}:advancedOptions` and restored on next visit. IF `localStorage` is unavailable or the stored value fails schema validation (missing required keys or values outside defined ranges), THEN THE Advanced Options panel SHALL initialise with the following defaults: `text` → GPT-4, Blog Post, language empty, brand voice off; `image` → DALL-E 3, Photorealistic, negative prompt empty, seed empty; `video` → GPT-4, 16:9, B-roll off, brand voice off; `audio` → ElevenLabs, first available voice, pitch 0, stability 50, MP3.

---

### Requirement 8 — Template Library

**User Story:** As a content creator, I want to browse and apply pre-built templates, so that I can jumpstart content creation without writing a prompt from scratch.

#### Acceptance Criteria

1. THE Studio SHALL render a **Templates** section that displays a browsable grid of template cards sourced from the `studio_templates` table.
2. THE `studio_templates` table SHALL store the following fields per template: `id`, `name`, `description`, `content_type`, `platform`, `tone`, `prompt_template`, `advanced_options` (JSONB), `is_system` (boolean, true for Creozel-provided templates), `team_id` (nullable, for user-saved templates), `created_at`.
3. THE Studio SHALL display both system templates (`is_system = true`) and templates saved by the active team (`team_id = activeTeam.id`).
4. THE Studio SHALL allow filtering templates by `content_type` and `platform` using filter controls above the template grid. WHEN no templates match the active filter combination, THE Studio SHALL display an empty-state message (e.g., "No templates match your filters") in place of the grid.
5. WHEN a template card is clicked, THE Studio SHALL overwrite the current values of the prompt input, content type selector, platform selector, tone selector, and advanced options with the values from that template, discarding any unsaved content in those fields.
6. WHEN a template is applied, THE Studio SHALL display a toast notification identifying the applied template name, which SHALL remain visible for 3–5 seconds before auto-dismissing.
7. THE Studio SHALL allow users to save the current Studio configuration as a new template by clicking a **Save as Template** button. WHEN clicked, THE Studio SHALL open a modal to collect a template name (required, 1–100 characters) and description (optional, 0–500 characters). IF either field violates its length constraint, THE Studio SHALL display an inline validation error and SHALL NOT submit the template.
8. WHEN the user submits the Save as Template modal with valid inputs, THE Studio SHALL insert a row into `studio_templates` capturing the current prompt, content type, platform, tone, length selection, and advanced options, with `team_id = activeTeam.id` and `is_system = false`.
9. WHEN a user-saved template is displayed, THE Studio SHALL render a delete button on the template card. WHEN the delete button is clicked, THE Studio SHALL display a confirmation prompt. IF the user confirms, THEN THE Studio SHALL delete the `studio_templates` row and remove the card from the grid. IF the user cancels, THEN THE Studio SHALL dismiss the prompt and make no changes.
10. THE `studio_templates` table SHALL have RLS policies enforcing that: system templates are readable by all authenticated users; user-saved templates are readable, insertable, and deletable only by members of the owning team.

---

### Requirement 9 — Credit Estimate Display

**User Story:** As a content creator, I want to see the credit cost before I generate, so that I can make an informed decision and avoid unexpected balance deductions.

#### Acceptance Criteria

1. THE Studio SHALL display a **Credit Estimate** section showing the estimated credit cost for the current configuration to two decimal places (e.g., "3.50 credits").
2. WHEN the content type, advanced options, or length selection changes, THE Studio SHALL display a loading indicator in the Credit Estimate section and SHALL update the displayed estimate within 500 ms of the change, without requiring a page reload.
3. IF the pricing data fetch fails or is unreachable when the Studio mounts or when options change, THEN THE credit estimate display SHALL show "Cost estimate unavailable" and SHALL NOT show a stale or zero cost figure.
4. THE Studio SHALL display the user's current credit balance alongside the estimate, refreshed on Studio mount and after each completed generation job, in the format "{balance} credits available".
5. WHEN the estimated credit cost exceeds the user's current credit balance, THE Studio SHALL display a visible inline warning message and SHALL disable the "Generate" button, replacing it with a "Top Up Credits" link that navigates to the credits purchase page.
6. WHEN the user's credit balance becomes sufficient to cover the current estimate (e.g., after a top-up or after changing options to a lower-cost configuration), THE Studio SHALL re-enable the "Generate" button and remove the inline warning.
7. WHILE the credit estimate is being fetched or recalculated, THE Studio SHALL disable the "Generate" button to prevent submission with a stale or unknown cost.

---

### Requirement 10 — Generate Action

**User Story:** As a content creator, I want to click a single "Generate" button to start AI content creation, so that the process is simple and the result appears in the same page without navigation.

#### Acceptance Criteria

1. WHEN the user clicks the **Generate** button and all required fields (prompt, content type, platform, tone, length) are populated and valid, THE Studio SHALL call `createContentJob` with the current configuration and transition the Output Panel to a loading state.
2. WHEN the "Generate" button is clicked, THE Studio SHALL disable the button and display a loading indicator for the duration of the generation job.
3. WHEN a generation job is submitted, THE Studio SHALL include the selected platform, tone, length, and all advanced option values in the `metadata` field of the `content_jobs` row.
4. WHEN a generation job is created, THE Studio SHALL subscribe to that job's row in `content_jobs` via Supabase Realtime and SHALL reflect status changes in the Output Panel within 2 seconds of the database update.
5. WHEN the job status transitions to `completed`, THE Studio SHALL display the generated content in the Output Panel and show a success toast notification.
6. WHEN the job status transitions to `failed`, THE Studio SHALL display the value of `content_jobs.error_message` in the Output Panel, or "An unknown error occurred" if `error_message` is null, and SHALL show an error toast notification.
7. WHEN a job is in `pending` or `running` status, THE Studio SHALL render a **Cancel** button. WHEN the Cancel button is clicked, THE Studio SHALL call `cancelJob`. IF `cancelJob` succeeds, THEN THE Output Panel SHALL reflect the `cancelled` status. IF `cancelJob` fails, THEN THE Studio SHALL display an error toast and leave the job status unchanged.
8. WHEN a generation job completes successfully, THE Studio SHALL trigger the existing media save flow to persist the generated asset to the Media Library. IF the media save flow fails, THEN THE Studio SHALL display a non-blocking warning toast and SHALL NOT prevent the user from viewing or copying the generated content.
9. WHEN the user clicks "Generate" and any required field is empty or invalid, THE Studio SHALL display inline validation messages for each invalid field and SHALL NOT call `createContentJob`.

---

### Requirement 11 — Output Panel

**User Story:** As a content creator, I want to see my generated content displayed clearly in the same page, with options to copy, download, and publish, so that I can act on the output immediately.

#### Acceptance Criteria

1. THE Output Panel SHALL display the current job status using the `StatusBadge` component (pending, running, completed, failed, cancelled).
2. WHEN the job type is `text` or `video` and the job status is `completed`, THE Output Panel SHALL fetch the content from `result_url` and render it as inline text. IF the fetch does not complete within 10 seconds, THE Output Panel SHALL treat it as a failed fetch.
3. WHEN the job type is `image` and the job status is `completed`, THE Output Panel SHALL render the generated image using an `<img>` element with `result_url` as the `src` and a descriptive `alt` attribute (e.g., the first 100 characters of the prompt).
4. WHEN the job type is `audio` and the job status is `completed`, THE Output Panel SHALL render an `<audio>` element with `result_url` as the `src` and native playback controls.
5. IF the job status is `completed` and the job type is `text` or `video`, THEN THE Output Panel SHALL provide a **Copy** button that copies the fetched text content to the clipboard.
6. IF the job status is `completed`, THEN THE Output Panel SHALL provide a **Download** button that initiates a file download from `result_url`.
7. IF the job status is `completed`, THEN THE Output Panel SHALL provide a **Publish** button that navigates to the Calendar page with the generated content pre-filled in the new post content field.
8. WHILE the Output Panel is fetching inline text content from `result_url`, THE Output Panel SHALL display a loading indicator and SHALL disable the Copy, Download, and Publish buttons.
9. IF the fetch of inline text content fails, THEN THE Output Panel SHALL display an error message and a fallback link to `result_url`.
10. WHEN a job reaches `completed` or `failed` status, THE Output Panel SHALL display a **Regenerate** button that resets the active job and re-enables the "Generate" button with the same configuration pre-filled.
11. WHEN the job status is not `completed`, THE Output Panel SHALL disable the Copy, Download, and Publish buttons.
12. WHEN the user clicks the **Copy** button and the clipboard write succeeds, THE Output Panel SHALL display a confirmation indicator (e.g., "Copied!") for 2–5 seconds before reverting to the default button label. IF the clipboard write fails, THE Output Panel SHALL display an inline error message.

---

### Requirement 12 — Save as Pipeline

**User Story:** As a content creator, I want to save my current Studio configuration as a reusable pipeline, so that I can run the same generation setup again later without re-entering all the options.

#### Acceptance Criteria

1. THE Studio SHALL render a **Save as Pipeline** button alongside the "Generate" button.
2. WHEN "Save as Pipeline" is clicked, THE Studio SHALL open the `SaveAsPipelineModal` dialog.
3. THE `SaveAsPipelineModal` SHALL collect: a pipeline name (required, max 100 characters) with an inline validation error shown on submit if empty or over limit; an optional description (max 500 characters); and an optional cron schedule as a free-text input. WHEN the cron schedule input changes, THE modal SHALL update a human-readable preview (e.g., "Every Monday at 9am") within 500 ms.
4. WHEN the user confirms in the `SaveAsPipelineModal`, THE Studio SHALL insert a row into the `pipelines` table with `team_id = activeTeam.id`, `name`, `description`, `schedule`, and a `config` JSONB field containing the serialised Studio form values (prompt, content type, platform, tone, length, advanced options).
5. WHEN the pipeline is saved successfully, THE Studio SHALL display a success toast notification that auto-dismisses after 3–5 seconds and SHALL close the modal.
6. IF the pipeline save fails, THEN THE Studio SHALL display an error toast notification, SHALL keep the modal open with all previously entered values preserved, so the user can retry.
7. THE `pipelines` table SHALL have RLS policies enforcing that pipelines are readable, insertable, updatable, and deletable only by members of the owning team.
8. THE Studio SHALL NOT require a schedule to save a pipeline; a pipeline without a schedule can be triggered manually from the Workflow Dashboard.
9. IF a pipeline with the same name already exists for the active team, THEN THE Studio SHALL display an inline error in the name field (e.g., "A pipeline with this name already exists") and SHALL NOT insert a duplicate row.

---

### Requirement 13 — Recent Jobs History

**User Story:** As a content creator, I want to see my recent generation jobs in the Studio, so that I can review past outputs and re-use successful configurations.

#### Acceptance Criteria

1. THE Studio SHALL display a **Recent Jobs** section showing the last 10 `content_jobs` rows for the active user scoped to `activeTeam.id`, ordered by `created_at` descending.
2. EACH recent job entry SHALL display: content type icon, prompt excerpt (first 80 characters followed by "…" if truncated), job status badge, creation timestamp in relative format (e.g., "2 hours ago"), and credit cost in the format "{cost} credits".
3. WHEN a recent job entry with status `completed` is clicked, THE Studio SHALL load that job's result into the Output Panel. IF the clicked job has no result (status is `pending`, `running`, `failed`, or `cancelled`), THEN THE Studio SHALL display the job's status in the Output Panel without attempting to fetch content.
4. IF a recent job entry has status `completed`, THEN THE Studio SHALL render a **Re-use Config** button on that entry. WHEN clicked, THE Studio SHALL pre-fill the prompt input and all metadata fields (content type, platform, tone, length, advanced options) with the values from that job's `metadata` field.
5. WHEN a new job completes or is cancelled, THE Studio SHALL refresh the Recent Jobs list via the existing Supabase Realtime subscription without requiring a page reload.
6. IF the Recent Jobs fetch fails, THEN THE Studio SHALL display an error message in the Recent Jobs section (e.g., "Failed to load recent jobs") and SHALL NOT display a blank or stale list.

---

### Requirement 14 — Persistence and State Restoration

**User Story:** As a content creator, I want my Studio configuration to be remembered across page refreshes, so that I do not lose my work if I accidentally navigate away.

#### Acceptance Criteria

1. WHEN any of the following values change — prompt, selected content type, selected platform, selected tone, or length selection — THE Studio SHALL write the updated draft config to `localStorage` under the key `{team_id}:studio:draftConfig` within 500 ms of the change (debounced).
2. WHEN the Studio mounts and `activeTeam` is non-null, THE Studio SHALL read `{team_id}:studio:draftConfig` from `localStorage`. IF the stored config is present and valid, THE Studio SHALL restore all persisted fields. IF only some fields are present, THE Studio SHALL restore those fields and apply defaults for any missing fields.
3. IF the stored draft config is absent, fails JSON parsing, is missing all required keys (`prompt`, `contentType`, `platform`, `tone`, `length`), or was written under a different `team_id`, THE Studio SHALL initialise with default values (empty prompt, `text` content type, `General` platform, `Professional` tone, `Medium` length).
4. WHEN a generation job completes successfully, THE Studio SHALL remove the key `{team_id}:studio:draftConfig` from `localStorage` for that team.
5. IF `localStorage` is unavailable (e.g., throws a `SecurityError`), THE Studio SHALL operate with in-memory state only and SHALL NOT display any error message to the user related to the storage failure.

---

### Requirement 15 — Accessibility and Code Quality

**User Story:** As a developer, I want the Studio to meet accessibility standards and TypeScript strict-mode compliance, so that the codebase remains consistent and the UI is usable by all creators.

#### Acceptance Criteria

1. ALL interactive controls in the Studio (buttons, selects, inputs, toggles) SHALL have associated `<label>` elements or `aria-label` attributes.
2. THE Studio SHALL support keyboard navigation: all controls SHALL be reachable and operable via the Tab key, and the "Generate" and "Save as Pipeline" buttons SHALL be activatable via the Enter key.
3. WHEN `npx tsc --noEmit` is executed from `frontend/` after implementing the Studio, THE TypeScript compiler SHALL exit with code 0 with no errors introduced by this spec.
4. ALL `catch` blocks in Studio-related service functions and components SHALL use `catch (error: unknown)` and SHALL call `reportError` from `src/utils/errorReporter.ts`.
5. THE Studio component and all sub-components SHALL be typed with explicit TypeScript interfaces; no `any` types or `Record<string, unknown>` are permitted for domain data structures.
6. THE Studio SHALL use the existing `supabase` client from `src/lib/supabase.ts` as the sole data access mechanism; no additional HTTP clients SHALL be introduced.

---

### Requirement 16 — Content Format Taxonomy (Phase 1)

**User Story:** As a content creator, I want to choose from a comprehensive set of content formats organised by category, so that I can generate exactly the type of content my audience expects on each platform.

#### Acceptance Criteria

1. THE Studio SHALL support the following Phase 1 `ContentFormat` values, grouped by `ContentCategory`. Each format SHALL be identified by a stable snake_case key used in `content_jobs.metadata.contentFormat`:

   **Category: `text`**
   - Short-form formats: `tweet` (Twitter/X post, max 280 characters), `thread` (Twitter/X thread, 2–25 tweets), `caption` (social media caption, max 2,200 characters), `hook` (attention-grabbing opening line, max 150 characters), `cta` (call-to-action copy, max 100 characters), `poll_text` (poll question + up to 4 options), `quote_post` (shareable quote graphic text), `status_update` (Facebook/LinkedIn status, max 63,206 characters), `community_post` (YouTube/Reddit community post), `meme_text` (top/bottom meme caption text), `story_text_overlay` (text overlay for story images), `product_announcement` (short product launch post)
   - Long-form formats: `blog_post` (500–5,000 words), `article` (800–3,000 words), `newsletter` (300–2,000 words), `seo_page` (SEO-optimised landing page copy, 500–3,000 words), `landing_page_copy` (conversion-focused page copy), `product_description` (e-commerce product copy, 50–500 words), `whitepaper` (2,000–10,000 words), `case_study` (800–3,000 words), `tutorial` (step-by-step guide, 500–5,000 words), `guide` (comprehensive reference, 1,000–10,000 words), `press_release` (400–800 words)
   - Conversational formats: `qa_post` (question-and-answer post), `ama_content` (Ask Me Anything response set), `community_response` (engagement reply copy)

   **Category: `image`**
   - Static formats: `single_image_post` (one image for any platform), `poster` (event or promotional poster), `ai_art` (AI-generated artwork), `infographic` (data or process visualisation), `motivational_graphic` (quote over background), `product_image` (product on clean background), `branded_creative` (brand-kit-styled graphic), `event_poster` (event announcement image), `announcement_banner` (wide-format announcement)
   - Multi-image formats: `carousel` (2–10 swipeable slides), `swipe_post` (alias for carousel), `before_after_set` (2-image comparison), `educational_slides` (3–10 slide deck images), `lookbook` (4–12 curated image set)
   - Advanced formats: `ai_generated_image` (single AI image with full prompt control), `meme` (image + overlaid text), `gif` (short looping animation, max 15 seconds)

   **Category: `video`**
   - Short-form formats: `reel` (Instagram Reel, 15–90 seconds, 9:16), `short` (YouTube Short, up to 60 seconds, 9:16), `tiktok_video` (TikTok, 15–180 seconds, 9:16), `vertical_video` (generic 9:16 short video), `promo_video` (15–60 second promotional clip), `talking_head_video` (presenter-style, 30–300 seconds), `loop_video` (seamlessly looping clip, 3–15 seconds)
   - Long-form formats: `youtube_video` (YouTube video script + scene breakdown, 3–60 minutes), `tutorial_video` (step-by-step instructional, 2–30 minutes), `product_demo` (product walkthrough, 1–10 minutes)
   - AI video formats: `faceless_video` (voiceover + stock footage script), `voiceover_video` (script with TTS narration cues), `subtitle_video` (script with auto-subtitle markers), `ai_explainer_video` (animated explainer script), `repurposed_clip` (short clip extracted from long-form source)

   **Category: `audio`**
   - Formats: `podcast_episode` (full episode script, 10–60 minutes), `voiceover` (narration script for video or ad), `tts_narration` (direct TTS generation from text), `audio_blog` (blog post converted to audio), `voice_note` (short spoken message, up to 3 minutes), `audio_ad` (30–60 second audio advertisement), `multilingual_dub` (translated and dubbed audio track)

   **Category: `story`**
   - Formats: `story_single` (single-frame story image or video, up to 15 seconds), `story_sequence` (2–5 connected story frames), `poll_story` (story frame with poll sticker copy), `quiz_story` (story frame with quiz sticker copy), `countdown_story` (story frame with countdown sticker copy), `link_story` (story frame with link sticker copy), `product_story` (product-showcase story frame)

2. THE Studio SHALL display each `ContentFormat` with its human-readable label, a one-line description, and the applicable platform(s) as a tag list within the format selector.
3. WHEN a `ContentFormat` is selected, THE Studio SHALL apply the following `PlatformConstraints` as UI hints and pre-generation validation rules:

   | ContentFormat | Platform | Character Limit | Aspect Ratio | Duration / Size Limit | File Format |
   |---|---|---|---|---|---|
   | `tweet` | Twitter/X | 280 chars | N/A | N/A | text |
   | `thread` | Twitter/X | 280 chars/tweet | N/A | 2–25 tweets | text |
   | `caption` | Instagram | 2,200 chars | N/A | N/A | text |
   | `caption` | LinkedIn | 3,000 chars | N/A | N/A | text |
   | `reel` | Instagram | N/A | 9:16 | 15–90 s | MP4 |
   | `short` | YouTube | N/A | 9:16 | ≤60 s | MP4 |
   | `tiktok_video` | TikTok | N/A | 9:16 | 15–180 s | MP4 |
   | `carousel` | Instagram | 2,200 chars caption | 1:1 or 4:5 | 2–10 slides | JPG/PNG |
   | `carousel` | LinkedIn | 3,000 chars caption | 1:1 or 1.91:1 | 2–20 slides | PDF/JPG |
   | `single_image_post` | Instagram | N/A | 1:1, 4:5, 1.91:1 | ≤30 MB | JPG/PNG |
   | `podcast_episode` | Podcast | N/A | N/A | 10–60 min | MP3/WAV |
   | `youtube_video` | YouTube | N/A | 16:9 | 3–60 min | MP4 |
   | `story_single` | Instagram | N/A | 9:16 | ≤15 s (video) | JPG/PNG/MP4 |

   For `ContentFormat` + `Platform` combinations not listed in this table, THE Studio SHALL apply no constraint validation and SHALL display "No specific constraints for this combination."

4. THE Studio SHALL enforce character-limit constraints by comparing the user's prompt length against the applicable limit for the selected `ContentFormat` + `Platform` combination. WHEN the prompt exceeds the limit, THE Studio SHALL display an inline warning and SHALL disable the "Generate" button.
5. THE Studio SHALL enforce aspect-ratio and duration constraints by surfacing them as required inputs in the Advanced Options panel for the relevant formats (e.g., duration input for `reel`, aspect ratio selector for `carousel`). WHEN a required constraint input is missing, THE Studio SHALL display an inline validation error and SHALL NOT submit a generation job.
6. THE `studio_templates` table `content_type` column SHALL be renamed to `content_category` and a new `content_format` column (text, not null) SHALL be added. WHEN existing system templates are seeded, EACH template SHALL include both `content_category` and `content_format` values.

---

### Requirement 17 — Repurposing Engine

**User Story:** As a content creator, I want to select an existing piece of content and repurpose it into a different format or platform, so that I can maximise the value of content I have already produced without starting from scratch.

#### Acceptance Criteria

1. THE Studio SHALL render a **Repurpose Content** entry point in the Configuration Panel, displayed as a secondary action button or tab alongside the standard prompt input.
2. WHEN the user activates the Repurpose Content mode, THE Studio SHALL display a source content picker that allows the user to select a source asset from either:
   a. The **Recent Jobs** list (completed `content_jobs` rows for the active team), or
   b. The **Media Library** (`media_items` rows for the active team).
3. WHEN a source asset is selected, THE Studio SHALL display the source asset's format label, platform, and a preview (text excerpt for text assets, thumbnail for image/video assets, waveform placeholder for audio assets).
4. WHEN a source asset is selected, THE Studio SHALL render a **Target Format** selector showing only the Phase 1 `ContentFormat` values that are valid repurposing targets for the source asset's category. The following repurposing paths SHALL be supported at minimum:
   - `blog_post` → `carousel`, `thread`, `caption`, `newsletter`, `short`, `tiktok_video`, `podcast_episode`
   - `youtube_video` → `short`, `tiktok_video`, `reel`, `repurposed_clip`, `blog_post`, `thread`
   - `podcast_episode` → `audio_blog`, `blog_post`, `thread`, `caption`, `quote_post`
   - `reel` / `short` / `tiktok_video` → `caption`, `story_single`, `tweet`
   - `carousel` → `blog_post`, `thread`, `newsletter`
5. WHEN the user selects a target format and clicks "Generate", THE Studio SHALL create a `RepurposingJob` by inserting a `content_jobs` row with `metadata.sourceJobId` (if the source is a Recent Job) or `metadata.sourceMediaId` (if the source is a Media Library item) populated alongside the standard `ContentFormatMetadataSchema` fields.
6. THE Edge Function SHALL detect the presence of `metadata.sourceJobId` or `metadata.sourceMediaId` and SHALL fetch the source content before constructing the AI prompt, injecting the source content as context for the repurposing transformation.
7. WHEN the repurposing job completes, THE Output Panel SHALL display the repurposed content alongside a "Source: [original asset name]" attribution label.
8. IF the source asset referenced by `metadata.sourceJobId` or `metadata.sourceMediaId` no longer exists (deleted or inaccessible), THEN THE Edge Function SHALL return a `failed` status with `error_message` set to "Source content is no longer available."
9. THE Studio SHALL allow the user to add an optional supplementary prompt in Repurpose Content mode to provide additional instructions for the transformation (e.g., "Make it more casual" or "Focus on the key statistics"). This supplementary prompt SHALL be stored in `metadata.repurposingInstructions`.
10. WHEN the user is in Repurpose Content mode, THE Studio SHALL display the standard platform selector and tone selector so the user can target a specific platform and tone for the repurposed output.

---

### Requirement 18 — Content Format Metadata Schema

**User Story:** As a developer, I want the `content_jobs.metadata` field to carry a structured, forward-compatible schema, so that the Edge Function, analytics, and future phases can reliably read and extend generation parameters without breaking changes.

#### Acceptance Criteria

1. THE `content_jobs.metadata` JSONB field SHALL conform to the following `ContentFormatMetadataSchema` for all jobs created by the Studio:

   ```json
   {
     "contentCategory": "text | image | video | audio | story",
     "contentFormat": "<snake_case ContentFormat key from Requirement 16>",
     "platform": "<platform name>",
     "tone": "<tone name>",
     "length": {
       "preset": "short | medium | long | custom | null",
       "minWords": "<integer | null>",
       "maxWords": "<integer | null>",
       "durationSeconds": "<integer | null>",
       "quantity": "<integer | null>",
       "speakingRate": "<float | null>"
     },
     "advancedOptions": {
       "model": "<string | null>",
       "resolution": "<string | null>",
       "style": "<string | null>",
       "negativePrompt": "<string | null>",
       "seed": "<integer | null>",
       "voice": "<string | null>",
       "pitch": "<integer | null>",
       "stability": "<integer | null>",
       "outputFormat": "<string | null>",
       "aspectRatio": "<string | null>",
       "includeBRoll": "<boolean | null>",
       "brandVoice": "<boolean | null>",
       "language": "<string | null>"
     },
     "platformConstraints": {
       "characterLimit": "<integer | null>",
       "aspectRatio": "<string | null>",
       "durationLimitSeconds": "<integer | null>",
       "fileSizeLimitMb": "<integer | null>",
       "acceptedFileFormats": ["<string>"]
     },
     "sourceJobId": "<uuid | null>",
     "sourceMediaId": "<uuid | null>",
     "repurposingInstructions": "<string | null>",
     "schemaVersion": "1"
   }
   ```

2. THE `schemaVersion` field SHALL be set to `"1"` for all jobs created by this spec. Future phases SHALL increment this value when introducing breaking schema changes, allowing the Edge Function to apply version-specific parsing logic.
3. WHEN the Studio submits a generation job, THE Studio SHALL populate all applicable fields in the `ContentFormatMetadataSchema`. Fields that are not applicable to the selected `ContentFormat` SHALL be set to `null` rather than omitted, so that the schema shape remains consistent across all job types.
4. THE `generate-content` Edge Function SHALL validate that `metadata.contentCategory` and `metadata.contentFormat` are present and non-null before processing a job. IF either field is absent, THEN THE Edge Function SHALL set the job status to `failed` with `error_message` set to "Invalid metadata: contentCategory and contentFormat are required."
5. THE `generate-content` Edge Function SHALL read `metadata.contentFormat` to select the appropriate AI provider, prompt template, and output post-processing logic for the job. The mapping of `contentFormat` to provider and prompt template SHALL be defined in a configuration object within the Edge Function, not hardcoded inline.
6. THE `content_jobs` table `metadata` column SHALL remain a JSONB column with no enforced JSON Schema constraint at the database level, so that future phases can extend the schema without a migration. Schema validation SHALL be performed exclusively in the Edge Function and the Studio frontend.
7. WHEN the Studio reads a `content_jobs` row to populate the Recent Jobs list or the Output Panel, THE Studio SHALL handle the case where `metadata.contentFormat` is absent (legacy jobs created before this spec) by falling back to `metadata.contentType` for display purposes, mapping the legacy values `text`, `image`, `video`, `audio` to the Phase 1 formats `short_form_post`, `ai_generated_image`, `faceless_video`, and `tts_narration` respectively.
8. THE `PipelineConfig` persisted in the `pipelines` table `config` JSONB field SHALL use the same `ContentFormatMetadataSchema` structure (minus `sourceJobId`, `sourceMediaId`, `repurposingInstructions`, and `schemaVersion`) so that pipeline execution produces jobs with a consistent metadata shape.
9. THE `studio_templates` table `advanced_options` JSONB column SHALL store only the `advancedOptions` sub-object of the `ContentFormatMetadataSchema`, and SHALL include `content_category` and `content_format` as separate top-level columns (not embedded in JSONB) to enable efficient filtering.

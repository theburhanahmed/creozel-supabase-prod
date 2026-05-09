# Tasks: MVP Content Generation

- [x] 1. Create Supabase Edge Function for content generation
  - [x] 1.1 Create `supabase/functions/generate-content/index.ts`
  - [x] 1.2 Handle text generation via OpenAI GPT-4
  - [x] 1.3 Handle image generation via DALL-E 3
  - [x] 1.4 Handle audio generation via ElevenLabs
  - [x] 1.5 Update content_jobs row on completion/failure
  - [x] 1.6 Upload result to Supabase Storage and save to media_items

- [x] 2. Create content service
  - [x] 2.1 Create `frontend/src/services/contentService.ts`
  - [x] 2.2 Implement `createContentJob` — inserts job row and invokes Edge Function
  - [x] 2.3 Implement `getPricingConfig` — fetches credit costs from pricing_config
  - [x] 2.4 Implement `cancelJob` — updates job status to failed, releases credits
  - [x] 2.5 Implement `subscribeToJob` — Realtime subscription to job row changes

- [x] 3. Build ContentHub page
  - [x] 3.1 Replace `frontend/src/pages/content/ContentHub.tsx` with full implementation
  - [x] 3.2 Add content type selector (Text, Image, Video, Audio) with credit cost display
  - [x] 3.3 Add prompt input with brand voice toggle
  - [x] 3.4 Add tone selector (Professional, Casual, Humorous, Inspirational)
  - [x] 3.5 Add generation progress indicator using Realtime subscription
  - [x] 3.6 Add result display with copy/download/save-to-library actions
  - [x] 3.7 Add error handling with toast notifications
  - [x] 3.8 Add credit cost estimation before submission

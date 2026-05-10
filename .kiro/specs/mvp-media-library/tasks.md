# Tasks — mvp-media-library

- [ ] 1. Verify `mediaService.ts` uses soft delete
  - Confirm `deleteMediaItem` sets `deleted_at = new Date().toISOString()` on the `media_items` row
  - If it hard-deletes, update to soft delete
  - Confirm `getMediaItems` filters `deleted_at IS NULL`
  - **Validates:** Requirements 2.1–2.3

- [ ] 2. Verify `media` Storage bucket exists with correct RLS
  - Check Supabase Storage for a `media` bucket (or `generated-content` bucket)
  - Confirm RLS policies restrict access to the file owner
  - If bucket is missing, add a migration to create it
  - **Validates:** Requirement 1.3

- [ ] 3. Verify upload creates `media_items` row with all required fields
  - Confirm `uploadMediaItem` inserts `storage_path`, `file_name`, `file_type`, `file_size_bytes`, `public_url`
  - **Validates:** Requirements 1.1–1.2

- [ ] 4. TypeScript strict mode verification
  - Run `npx tsc --noEmit` from `frontend/`
  - Fix any errors in `MediaGallery.tsx` and `mediaService.ts`
  - **Validates:** Requirement 4.1

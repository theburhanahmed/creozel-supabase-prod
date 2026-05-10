# Requirements — mvp-media-library

## Introduction

The Media Gallery page (`MediaGallery.tsx`) is fully implemented with upload, delete, search, and type filtering. The remaining gaps are: verifying the `media` Supabase Storage bucket exists with correct RLS, ensuring soft-delete is used (setting `deleted_at` rather than hard-deleting), and TypeScript strict mode compliance.

## Glossary

- **MediaGallery**: Page at `frontend/src/pages/MediaGallery.tsx`
- **mediaService**: Service at `frontend/src/services/mediaService.ts`
- **media bucket**: The Supabase Storage bucket for user-uploaded and AI-generated media

## Requirements

### Requirement 1 — Media Upload and Storage

**User Story:** As a user, I want to upload media files and have them stored in Supabase Storage.

#### Acceptance Criteria

1. THE `uploadMediaItem` function SHALL upload the file to the `media` Supabase Storage bucket at path `{userId}/{timestamp}_{filename}`.
2. AFTER a successful upload, THE function SHALL insert a row into `media_items` with `storage_path`, `file_name`, `file_type`, `file_size_bytes`, and `public_url`.
3. THE `media` Storage bucket SHALL have RLS policies that restrict access to the file owner.

### Requirement 2 — Media Deletion

**User Story:** As a user, I want to delete media files from my library.

#### Acceptance Criteria

1. THE `deleteMediaItem` function SHALL remove the file from Supabase Storage.
2. THE function SHALL set `deleted_at = now()` on the `media_items` row (soft delete) rather than hard-deleting.
3. SOFT-DELETED items SHALL NOT appear in the `getMediaItems` query results (filter `deleted_at IS NULL`).

### Requirement 3 — Filtering and Search

**User Story:** As a user, I want to filter media by type and search by filename.

#### Acceptance Criteria

1. THE `MediaGallery` page SHALL filter items client-side by `type` and by `name` substring match.
2. WHEN no items match the filter, THE page SHALL show a "No files match your filters" message.

### Requirement 4 — TypeScript Strict Mode

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed, THE TypeScript compiler SHALL exit with code 0 with no errors in `MediaGallery.tsx` or `mediaService.ts`.

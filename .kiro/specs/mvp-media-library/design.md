# Design — mvp-media-library

## Overview

The Media Gallery page is fully implemented. The design documents the existing architecture and identifies the verification tasks needed.

## Architecture

```
MediaGallery.tsx
  ├── getMediaItems(userId)         → supabase.from('media_items').select('*').eq('user_id', userId)
  ├── uploadMediaItem(userId, file) → supabase.storage.from('media').upload(path, file)
  │                                    + supabase.from('media_items').insert(...)
  └── deleteMediaItem(item)         → supabase.storage.from('media').remove([item.storage_path])
                                       + supabase.from('media_items').delete().eq('id', item.id)
```

## Storage Bucket

The `media` bucket must exist in Supabase Storage with:
- Private access (signed URLs for download)
- RLS policy: users can only access their own files

## Correctness Properties

- **Upload creates media_items row**: After a successful upload, a `media_items` row with the correct `storage_path`, `file_type`, and `file_size_bytes` must exist.
- **Delete removes both Storage and DB**: Deleting a media item must remove both the Storage object and the `media_items` row.
- **Soft delete**: The `deleted_at` column is set rather than hard-deleting, for the `storage_usage` view.

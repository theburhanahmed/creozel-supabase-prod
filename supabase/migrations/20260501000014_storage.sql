-- Migration: Supabase Storage Buckets

-- Generated content bucket (AI outputs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-content',
  'generated-content',
  true,
  52428800, -- 50MB
  array['text/plain', 'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/mp3', 'video/mp4']
)
on conflict (id) do nothing;

-- User media uploads bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  104857600, -- 100MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'application/pdf']
)
on conflict (id) do nothing;

-- Storage RLS: users can upload to their own folder
create policy "Users can upload to own folder in generated-content"
  on storage.objects for insert
  with check (
    bucket_id = 'generated-content'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Public read for generated-content"
  on storage.objects for select
  using (bucket_id = 'generated-content');

create policy "Users can upload to own folder in media"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Public read for media"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "Users can delete own files in media"
  on storage.objects for delete
  using (
    bucket_id = 'media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

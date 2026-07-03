import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { ContentJob, MediaItem, MediaType } from '../types'

export async function getMediaItems(userId: string, teamId?: string | null, type?: MediaType): Promise<MediaItem[]> {
  try {
    let query = supabase
      .from('media_items')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (teamId) {
      query = query.eq('team_id', teamId)
    } else {
      query = query.is('team_id', null)
    }
    if (type) query = query.eq('type', type)
    const { data, error } = await query
    if (error) { reportError('getMediaItems [mediaService.ts]', error); return [] }
    return (data ?? []) as MediaItem[]
  } catch (error: unknown) {
    reportError('getMediaItems [mediaService.ts]', error)
    return []
  }
}

export async function uploadMediaItem(
  userId: string,
  file: File,
  teamId?: string | null,
): Promise<MediaItem | null> {
  try {
    const scopePath = teamId ? `${teamId}/${userId}` : `${userId}/personal`
    const path = `${scopePath}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: false })
    if (uploadError) { reportError('uploadMediaItem [mediaService.ts]', uploadError); return null }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)

    const type: MediaType = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio'
      : 'document'

    const { data, error } = await supabase.from('media_items').insert({
      user_id: userId, team_id: teamId ?? null, name: file.name, type,
      size_bytes: file.size, storage_path: path, public_url: urlData.publicUrl,
    }).select().single()

    if (error) { reportError('uploadMediaItem [mediaService.ts]', error); return null }
    return data as MediaItem
  } catch (error: unknown) {
    reportError('uploadMediaItem [mediaService.ts]', error)
    return null
  }
}

/**
 * Persist a completed content job's result to the media_items table.
 * Derives the media type from the job's content type.
 * Returns the created MediaItem or null on failure.
 */
export async function saveMediaItemFromJob(
  job: ContentJob,
  userId: string,
  teamId: string,
): Promise<MediaItem | null> {
  if (!job.result_url) return null

  try {
    const typeMap: Record<string, MediaType> = {
      image: 'image',
      video: 'video',
      audio: 'audio',
      text:  'document',
    }
    const mediaType: MediaType = typeMap[job.type] ?? 'document'

    // Derive a human-readable name from the prompt (first 60 chars)
    const name = job.prompt.slice(0, 60).trim() || 'Generated content'

    const { data, error } = await supabase
      .from('media_items')
      .insert({
        user_id:      userId,
        team_id:      teamId,
        name,
        type:         mediaType,
        size_bytes:   0,
        storage_path: job.result_url,
        public_url:   job.result_url,
        metadata:     { source_job_id: job.id },
      })
      .select()
      .single()

    if (error) {
      reportError('saveMediaItemFromJob [mediaService.ts]', error, { jobId: job.id })
      return null
    }

    return data as MediaItem
  } catch (error: unknown) {
    reportError('saveMediaItemFromJob [mediaService.ts]', error, { jobId: job.id })
    return null
  }
}

export async function deleteMediaItem(item: MediaItem): Promise<boolean> {
  try {
    // Remove from Storage
    await supabase.storage.from('media').remove([item.storage_path])
    // Soft delete — set deleted_at instead of hard delete
    let query = supabase
      .from('media_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('user_id', item.user_id)
    if (item.team_id) {
      query = query.eq('team_id', item.team_id)
    } else {
      query = query.is('team_id', null)
    }
    const { error } = await query
    if (error) { reportError('deleteMediaItem [mediaService.ts]', error); return false }
    return true
  } catch (error: unknown) {
    reportError('deleteMediaItem [mediaService.ts]', error)
    return false
  }
}

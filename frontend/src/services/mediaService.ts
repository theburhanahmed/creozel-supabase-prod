import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { MediaItem, MediaType } from '../types'

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
  if (!teamId) {
    reportError('uploadMediaItem [mediaService.ts]', new Error('teamId is required'))
    return null
  }
  try {
    const path = `${teamId}/${userId}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: false })
    if (uploadError) { reportError('uploadMediaItem [mediaService.ts]', uploadError); return null }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)

    const type: MediaType = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio'
      : 'document'

    const { data, error } = await supabase.from('media_items').insert({
      user_id: userId, team_id: teamId, name: file.name, type,
      size_bytes: file.size, storage_path: path, public_url: urlData.publicUrl,
    }).select().single()

    if (error) { reportError('uploadMediaItem [mediaService.ts]', error); return null }
    return data as MediaItem
  } catch (error: unknown) {
    reportError('uploadMediaItem [mediaService.ts]', error)
    return null
  }
}

export async function deleteMediaItem(item: MediaItem): Promise<boolean> {
  if (!item.team_id) {
    reportError('deleteMediaItem [mediaService.ts]', new Error('item.team_id is required'))
    return false
  }
  try {
    // Remove from Storage
    await supabase.storage.from('media').remove([item.storage_path])
    // Soft delete — set deleted_at instead of hard delete
    const { error } = await supabase
      .from('media_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('team_id', item.team_id)
    if (error) { reportError('deleteMediaItem [mediaService.ts]', error); return false }
    return true
  } catch (error: unknown) {
    reportError('deleteMediaItem [mediaService.ts]', error)
    return false
  }
}

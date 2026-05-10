import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { MediaItem, MediaType } from '../types'

export async function getMediaItems(userId: string, teamId?: string, type?: MediaType): Promise<MediaItem[]> {
  try {
    let query = supabase
      .from('media_items')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (teamId) query = query.eq('team_id', teamId)
    else query = query.eq('user_id', userId)
    if (type) query = query.eq('type', type)
    const { data, error } = await query
    if (error) { reportError('mediaService.getMediaItems', error); return [] }
    return (data ?? []) as MediaItem[]
  } catch (error: unknown) {
    reportError('mediaService.getMediaItems', error)
    return []
  }
}

export async function uploadMediaItem(
  userId: string,
  file: File,
  teamId?: string,
): Promise<MediaItem | null> {
  try {
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${userId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: false })
    if (uploadError) { reportError('mediaService.uploadMediaItem', uploadError); return null }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)

    const type: MediaType = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio'
      : 'document'

    const { data, error } = await supabase.from('media_items').insert({
      user_id: userId, team_id: teamId ?? null, name: file.name, type,
      size_bytes: file.size, storage_path: path, public_url: urlData.publicUrl,
    }).select().single()

    if (error) { reportError('mediaService.uploadMediaItem', error); return null }
    return data as MediaItem
  } catch (error: unknown) {
    reportError('mediaService.uploadMediaItem', error)
    return null
  }
}

export async function deleteMediaItem(item: MediaItem): Promise<boolean> {
  try {
    // Remove from Storage
    await supabase.storage.from('media').remove([item.storage_path])
    // Soft delete — set deleted_at instead of hard delete
    const { error } = await supabase
      .from('media_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) { reportError('mediaService.deleteMediaItem', error); return false }
    return true
  } catch (error: unknown) {
    reportError('mediaService.deleteMediaItem', error)
    return false
  }
}

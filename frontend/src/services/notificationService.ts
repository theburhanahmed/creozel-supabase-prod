import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { Notification } from '../types'

export async function getNotifications(userId: string, limit = 50): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) { reportError('notificationService.getNotifications', error); return [] }
    return (data ?? []) as Notification[]
  } catch (error: unknown) {
    reportError('notificationService.getNotifications', error)
    return []
  }
}

export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
  } catch (error: unknown) {
    reportError('notificationService.markAsRead', error)
  }
}

export async function markAllAsRead(userId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  } catch (error: unknown) {
    reportError('notificationService.markAllAsRead', error)
  }
}

export function subscribeToNotifications(userId: string, onNew: (n: Notification) => void): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onNew(payload.new as Notification))
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

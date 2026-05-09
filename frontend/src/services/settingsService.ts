import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { User, BrandProfile, NotificationPreferences } from '../types'

export interface ProfileUpdate {
  display_name?: string
  avatar_url?: string
  bio?: string
  phone?: string
  timezone?: string
  notification_preferences?: NotificationPreferences
}

/**
 * Fetch the full profile for the current user.
 */
export async function getProfile(userId: string): Promise<Partial<User> | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      reportError('settingsService.getProfile', error, { userId })
      return null
    }

    return data as Partial<User>
  } catch (error: unknown) {
    reportError('settingsService.getProfile', error, { userId })
    return null
  }
}

/**
 * Update the current user's profile.
 */
export async function updateProfile(
  userId: string,
  updates: ProfileUpdate,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      reportError('settingsService.updateProfile', error, { userId })
      return false
    }

    return true
  } catch (error: unknown) {
    reportError('settingsService.updateProfile', error, { userId })
    return false
  }
}

/**
 * Fetch the brand profile for the current user.
 */
export async function getBrandProfile(userId: string): Promise<BrandProfile | null> {
  try {
    const { data, error } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      reportError('settingsService.getBrandProfile', error, { userId })
      return null
    }

    return data as BrandProfile | null
  } catch (error: unknown) {
    reportError('settingsService.getBrandProfile', error, { userId })
    return null
  }
}

/**
 * Create or update the brand profile for the current user.
 */
export async function upsertBrandProfile(
  userId: string,
  updates: Partial<Omit<BrandProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('brand_profiles')
      .upsert(
        { user_id: userId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )

    if (error) {
      reportError('settingsService.upsertBrandProfile', error, { userId })
      return false
    }

    return true
  } catch (error: unknown) {
    reportError('settingsService.upsertBrandProfile', error, { userId })
    return false
  }
}

/**
 * Change the current user's password via GoTrue.
 */
export async function updatePassword(newPassword: string): Promise<boolean> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      reportError('settingsService.updatePassword', error)
      return false
    }

    return true
  } catch (error: unknown) {
    reportError('settingsService.updatePassword', error)
    return false
  }
}

/**
 * Update notification preferences.
 */
export async function updateNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): Promise<boolean> {
  return updateProfile(userId, { notification_preferences: prefs })
}

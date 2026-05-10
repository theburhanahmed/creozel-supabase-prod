import { supabase } from '../lib/supabase'
import type { User } from '../types'

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
}

/**
 * Auth service — all operations go through Supabase GoTrue (self-hosted).
 * No mock data, no localStorage hacks. Session is managed by the Supabase client.
 */
export const authService = {
  /**
   * Sign in with email + password via GoTrue.
   */
  async login(credentials: LoginCredentials): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Login failed: no user returned')
    return mapSupabaseUser(data.user)
  },

  /**
   * Register a new account via GoTrue.
   * Email confirmation is required unless ENABLE_EMAIL_AUTOCONFIRM=true in .env.
   */
  async register(data: RegisterData): Promise<User> {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
      },
    })
    if (error) throw new Error(error.message)
    if (!authData.user) throw new Error('Registration failed: no user returned')
    return mapSupabaseUser(authData.user)
  },

  /**
   * Sign out and clear the session.
   */
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },

  /**
   * Get the currently authenticated user from the live session.
   * Returns null if not authenticated.
   */
  async getCurrentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    return mapSupabaseUser(data.user)
  },

  /**
   * Subscribe to auth state changes (login, logout, token refresh).
   */
  onAuthStateChange(
    callback: (user: User | null) => void,
  ): { unsubscribe: () => void } {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void mapSupabaseUser(session.user).then(callback)
      } else {
        callback(null)
      }
    })
    return { unsubscribe: () => data.subscription.unsubscribe() }
  },

  /**
   * Send a password reset email.
   */
  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) throw new Error(error.message)
  },

  /**
   * Update the current user's password (after reset flow).
   */
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)
  },
}

/**
 * Map a Supabase auth user to our app's User type.
 * Fetches onboarding_completed from the profiles table.
 */
async function mapSupabaseUser(supabaseUser: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): Promise<User> {
  const meta = supabaseUser.user_metadata ?? {}

  let onboarding_completed = false
  try {
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', supabaseUser.id)
      .single()
    if (data) {
      onboarding_completed = (data as { onboarding_completed: boolean }).onboarding_completed ?? false
    }
  } catch {
    // Non-fatal — default to false, user will be redirected to onboarding
  }

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    display_name:
      (meta['name'] as string) ??
      (meta['full_name'] as string) ??
      supabaseUser.email?.split('@')[0] ??
      'User',
    avatar_url: (meta['avatar_url'] as string) ?? '',
    timezone: 'UTC',
    notification_preferences: {},
    onboarding_completed,
    credits: 0,
    isAuthenticated: true,
  }
}

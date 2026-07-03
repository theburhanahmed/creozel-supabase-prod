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

export interface RegisterResult {
  user: User
  requiresEmailConfirmation: boolean
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
  async register(data: RegisterData): Promise<RegisterResult> {
    const { data: result, error } = await supabase.functions.invoke('register', {
      body: data,
    })
    if (error) throw new Error(error.message)
    const response = result as
      | { error: string; user?: undefined; requiresEmailConfirmation?: undefined }
      | { error?: undefined; user: typeof result.user; requiresEmailConfirmation: boolean }
    if (response.error) throw new Error(response.error)
    if (!response.user) throw new Error('Registration failed: no user returned')

    const user = await mapSupabaseUser(response.user)

    if (response.requiresEmailConfirmation) {
      return { user, requiresEmailConfirmation: true }
    }

    // When email auto-confirmation is enabled, establish a session for the new user.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (signInError) throw new Error(signInError.message)

    return { user, requiresEmailConfirmation: false }
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
    if (!data.user || !isEmailConfirmed(data.user)) return null
    return mapSupabaseUser(data.user)
  },

  /**
   * Subscribe to auth state changes (login, logout, token refresh).
   */
  onAuthStateChange(
    callback: (user: User | null) => void,
  ): { unsubscribe: () => void } {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && isEmailConfirmed(session.user)) {
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
 * Returns true if the user has confirmed their email address.
 * Supabase exposes `email_confirmed_at` (or the legacy `confirmed_at` field).
 */
function isEmailConfirmed(
  user: { email_confirmed_at?: string; confirmed_at?: string },
): boolean {
  return !!(user.email_confirmed_at || user.confirmed_at)
}

/**
 * Map a Supabase auth user to our app's User type.
 * Fetches onboarding_completed from the profiles table, creating the row if
 * it doesn't exist yet (handles users who signed up before the trigger was
 * in place, or edge cases where the trigger silently failed).
 */
async function mapSupabaseUser(supabaseUser: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): Promise<User> {
  const meta = supabaseUser.user_metadata ?? {}

  const displayName =
    (meta['name'] as string) ??
    (meta['full_name'] as string) ??
    supabaseUser.email?.split('@')[0] ??
    'User'

  let onboarding_completed = false
  try {
    // Upsert ensures the row always exists — safe to call on every login.
    // ignoreDuplicates: true means existing rows are never overwritten.
    // We do NOT chain .select() here to avoid a 406 from PostgREST when the
    // RLS "return=representation" check conflicts with the INSERT policy.
    await supabase
      .from('profiles')
      .upsert(
        {
          id: supabaseUser.id,
          display_name: displayName,
          avatar_url: (meta['avatar_url'] as string) ?? null,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )

    // Separate SELECT to read onboarding status — covered by the SELECT policy.
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
    display_name: displayName,
    avatar_url: (meta['avatar_url'] as string) ?? '',
    timezone: 'UTC',
    notification_preferences: {},
    onboarding_completed,
    credits: 0,
    isAuthenticated: true,
  }
}

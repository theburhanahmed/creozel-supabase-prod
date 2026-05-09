import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client wired to the local self-hosted instance via Kong (port 8000).
 * In production, swap VITE_SUPABASE_URL to your hosted Supabase project URL.
 *
 * Required env vars (copy .env.example → .env in the repo root, then set these):
 *   VITE_SUPABASE_URL      — e.g. http://localhost:8000
 *   VITE_SUPABASE_ANON_KEY — the ANON_KEY from your .env file
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy frontend/.env.example to frontend/.env and fill in the values.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage so page refreshes keep the user logged in
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type SupabaseClient = typeof supabase

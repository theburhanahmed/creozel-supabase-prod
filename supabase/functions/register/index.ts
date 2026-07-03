/**
 * Edge Function: register
 *
 * Server-side registration endpoint that enforces the Creozel password policy
 * before creating the user via Supabase Auth. This guarantees that weak
 * passwords cannot be injected by bypassing the frontend form.
 *
 * Request body (POST):
 *   { email: string, password: string, name: string }
 *
 * Success Response (200):
 *   { user: { id, email, user_metadata }, requiresEmailConfirmation: boolean }
 *
 * Error Responses:
 *   400: { error: 'invalid_password' }  — password does not meet policy
 *   400: { error: string }              — Supabase Auth validation error
 *   500: { error: 'registration_failed' }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PASSWORD_MIN_LENGTH = 8

function isValidPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  )
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  // Prefer the anon key for the public sign-up call so GoTrue treats it as a
  // normal user registration (including confirmation email flow). Fall back to
  // the service role key if the anon key is not injected in the environment.
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = (await req.json()) as {
      email?: unknown
      password?: unknown
      name?: unknown
    }

    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!isValidPassword(password)) {
      return new Response(
        JSON.stringify({
          error: 'invalid_password',
          message:
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, and a number`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!data.user) {
      return new Response(
        JSON.stringify({ error: 'registration_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const user = data.user as { email_confirmed_at?: string | null; confirmed_at?: string | null }
    const isConfirmed = !!(user.email_confirmed_at || user.confirmed_at)

    return new Response(
      JSON.stringify({
        user: data.user,
        requiresEmailConfirmation: !isConfirmed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[register] error:', message)
    return new Response(
      JSON.stringify({ error: 'registration_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

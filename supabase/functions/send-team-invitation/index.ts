/**
 * Edge Function: send-team-invitation
 *
 * Sends an email invitation when a team invitation is created.
 * Invoked by the frontend after inserting a row into public.team_invitations.
 *
 * Request body (POST, requires a valid Supabase JWT):
 *   { invitation_id: string, team_id: string }
 *
 * Success Response (200):
 *   { sent: true }
 *
 * Error Responses:
 *   400: { error: 'invalid_request' }
 *   401: { error: 'unauthorized' }
 *   403: { error: 'forbidden' }
 *   404: { error: 'invitation_not_found' }
 *   500: { error: 'email_failed' }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // ── Auth helper ─────────────────────────────────────────────────────────────
  async function getAuthenticatedUser(): Promise<{ id: string } | null> {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return null
    try {
      const userClient = createClient(supabaseUrl, serviceKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data, error } = await userClient.auth.getUser()
      if (error || !data.user) return null
      return { id: data.user.id }
    } catch (err) {
      console.error('[send-team-invitation] auth validation error:', err)
      return null
    }
  }

  async function canManageTeam(userId: string, teamId: string): Promise<boolean> {
    const { data } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .in('role', ['owner', 'admin'])
      .maybeSingle()
    return data !== null
  }

  try {
    const caller = await getAuthenticatedUser()
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = (await req.json()) as { invitation_id?: unknown; team_id?: unknown }
    const invitationId = typeof body.invitation_id === 'string' ? body.invitation_id : ''
    const teamId = typeof body.team_id === 'string' ? body.team_id : ''

    if (!invitationId || !teamId) {
      return new Response(
        JSON.stringify({ error: 'invalid_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!(await canManageTeam(caller.id, teamId))) {
      return new Response(
        JSON.stringify({ error: 'forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch invitation + team name
    const { data: invite, error: inviteError } = await supabase
      .from('team_invitations')
      .select('email, token, teams(name)')
      .eq('id', invitationId)
      .eq('team_id', teamId)
      .is('accepted_at', null)
      .single()

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: 'invitation_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const email = invite.email as string
    const token = invite.token as string
    const teamName = (invite.teams as { name?: string } | null)?.name ?? 'Creozel'
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://app.creozel.com'
    const acceptUrl = `${siteUrl}/auth/accept-invitation?token=${encodeURIComponent(token)}`

    const smtpHost = Deno.env.get('SMTP_HOSTNAME') ?? Deno.env.get('SMTP_HOST') ?? ''
    const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? 465)
    const smtpUser = Deno.env.get('SMTP_USERNAME') ?? Deno.env.get('SMTP_USER') ?? Deno.env.get('EMAIL_HOST_USER') ?? ''
    const smtpPass = Deno.env.get('SMTP_PASSWORD') ?? Deno.env.get('SMTP_PASS') ?? Deno.env.get('EMAIL_HOST_PASSWORD') ?? ''
    const fromEmail = Deno.env.get('SMTP_FROM') ?? Deno.env.get('DEFAULT_FROM_EMAIL') ?? 'noreply@creozel.com'

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: 'email_not_configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    })

    await client.send({
      from: fromEmail,
      to: email,
      subject: `You've been invited to join ${teamName} on Creozel`,
      content: `Hi there,

You've been invited to join the "${teamName}" team on Creozel.

Accept your invitation here:
${acceptUrl}

This link expires in 7 days.

- The Creozel Team`,
      html: `<p>Hi there,</p>
<p>You've been invited to join the "<strong>${teamName}</strong>" team on Creozel.</p>
<p><a href="${acceptUrl}" style="display:inline-block;padding:10px 20px;background:#3FE0A5;color:#fff;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
<p>Or copy and paste this link into your browser:<br><code>${acceptUrl}</code></p>
<p>This link expires in 7 days.</p>
<p>- The Creozel Team</p>`,
    })

    await client.close()

    return new Response(
      JSON.stringify({ sent: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[send-team-invitation] error:', err)
    return new Response(
      JSON.stringify({ error: 'email_failed', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

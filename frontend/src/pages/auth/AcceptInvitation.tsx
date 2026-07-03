import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { MailIcon, CheckCircleIcon, AlertCircleIcon, Loader2Icon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { acceptInvitation } from '../../services/teamService'

export const AcceptInvitation: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user } = useAppContext()
  const [state, setState] = useState<'loading' | 'success' | 'error' | 'auth-required'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setState('error')
      setErrorMessage('Invitation token is missing.')
      return
    }

    if (!user) {
      setState('auth-required')
      return
    }

    void (async () => {
      const teamId = await acceptInvitation(token)
      if (teamId) {
        setState('success')
        toast.success('You have joined the team!')
        setTimeout(() => {
          navigate('/team', { replace: true })
        }, 1500)
      } else {
        setState('error')
        setErrorMessage('This invitation is invalid, expired, or was sent to a different email address.')
      }
    })()
  }, [token, user, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0E14] px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8 md:p-10 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white font-bold text-2xl shadow-2xl shadow-[#3FE0A5]/30">
            C
          </div>
        </div>

        {state === 'loading' && (
          <>
            <Loader2Icon size={48} className="text-[#3FE0A5] mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Accepting invitation…</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Please wait while we add you to the team.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircleIcon size={48} className="text-[#3FE0A5] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You are in!</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Redirecting you to the team page…</p>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircleIcon size={48} className="text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invitation failed</h1>
            <p className="text-red-600 dark:text-red-300 text-sm mb-6">{errorMessage}</p>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#3FE0A5] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Go to Dashboard
            </a>
          </>
        )}

        {state === 'auth-required' && (
          <>
            <MailIcon size={48} className="text-[#3FE0A5] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Sign in to accept</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Please sign in or create an account with the email address that received the invitation.
            </p>
            <a
              href={`/auth/login?redirect=${encodeURIComponent(`/auth/accept-invitation?token=${token ?? ''}`)}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#3FE0A5] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Sign in
            </a>
          </>
        )}
      </div>
    </div>
  )
}

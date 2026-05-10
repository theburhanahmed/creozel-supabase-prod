import React, { useState } from 'react'
import { MailIcon, AlertCircleIcon, CheckCircleIcon, ArrowLeftIcon } from 'lucide-react'
import { authService } from '../../services/authService'
import { reportError } from '../../utils/errorReporter'

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || submitted) return
    setLoading(true)
    setError('')
    try {
      await authService.resetPassword(email)
      setSubmitted(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email'
      setError(message)
      reportError('ForgotPassword.handleSubmit', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0E14] px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8 md:p-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white font-bold text-2xl shadow-2xl shadow-[#3FE0A5]/30">
              C
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            Reset your password
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircleIcon size={48} className="text-[#3FE0A5]" />
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              Check your email for a password reset link. It may take a few minutes to arrive.
            </p>
            <a
              href="/auth/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#3FE0A5] hover:text-[#38B897] transition-colors"
            >
              <ArrowLeftIcon size={16} />
              Back to login
            </a>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-start gap-3">
                <AlertCircleIcon size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <MailIcon size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 block w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5 text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || submitted}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold py-3.5 rounded-xl shadow-xl shadow-[#3FE0A5]/30 transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <a
                href="/auth/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#3FE0A5] hover:text-[#38B897] transition-colors"
              >
                <ArrowLeftIcon size={16} />
                Back to login
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

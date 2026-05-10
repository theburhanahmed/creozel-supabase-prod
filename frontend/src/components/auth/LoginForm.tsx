import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  LogInIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
} from 'lucide-react'
import { authService } from '../../services/authService'
import { debounce } from '../../lib/utils'

export const LoginForm: React.FC = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  // Debounced submit — 1 s as per PRD §6.1
  const handleLoginDebounced = useRef(
    debounce((...args: unknown[]) => {
      const emailVal    = args[0] as string
      const passwordVal = args[1] as string
      setError('')
      authService
        .login({ email: emailVal, password: passwordVal })
        .then(() => {
          // Auth state is updated exclusively via onAuthStateChange in AppContext
          toast.success('Welcome back!')
          navigate('/', { replace: true })
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Login failed')
        })
        .finally(() => setLoading(false))
    }, 1000),
  ).current

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    handleLoginDebounced(email, password)
  }

  return (
    <div className="max-w-md w-full mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8 md:p-10">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white font-bold text-2xl shadow-2xl shadow-[#3FE0A5]/30">
            C
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
          Welcome back
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Sign in to your Creozel account
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-start gap-3">
          <AlertCircleIcon size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Email Address
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${emailFocused ? 'text-[#3FE0A5]' : 'text-gray-400'}`}>
              <MailIcon size={18} />
            </div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              className="pl-12 block w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5 text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]"
              placeholder="you@example.com"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${passwordFocused ? 'text-[#3FE0A5]' : 'text-gray-400'}`}>
              <LockIcon size={18} />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              className="pl-12 pr-12 block w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5 text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>
        </div>

        {/* Forgot password */}
        <div className="flex justify-end">
          <a
            href="/auth/forgot-password"
            className="text-sm font-semibold text-[#3FE0A5] hover:text-[#38B897] transition-colors"
          >
            Forgot password?
          </a>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] hover:from-[#38B897] hover:to-[#3FE0A5] text-white font-semibold py-3.5 rounded-xl shadow-xl shadow-[#3FE0A5]/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <LogInIcon size={18} />
              Sign in
            </>
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Don't have an account?{' '}
        <a href="/auth/register" className="font-semibold text-[#3FE0A5] hover:text-[#38B897] transition-colors">
          Sign up
        </a>
      </p>
    </div>
  )
}

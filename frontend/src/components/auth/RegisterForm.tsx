import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  UserPlusIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
  UserIcon,
} from 'lucide-react'
import { authService } from '../../services/authService'
import { useAppContext } from '../../context/AppContext'
import { isValidEmail, isValidPassword } from '../../lib/utils'

export const RegisterForm: React.FC = () => {
  const navigate = useNavigate()
  const { setUser } = useAppContext()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }
    if (!isValidPassword(password)) {
      setError(
        'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number',
      )
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!acceptTerms) {
      setError('You must accept the terms and conditions')
      return
    }

    setLoading(true)
    try {
      const { user, requiresEmailConfirmation } = await authService.register({
        name: fullName,
        email,
        password,
      })
      if (requiresEmailConfirmation) {
        toast.success('Account created! Please check your email to confirm your account.')
        navigate('/auth/confirm-sent', { replace: true })
      } else {
        setUser(user)
        toast.success('Account created!')
        navigate('/', { replace: true })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md w-full mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8 md:p-10">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white font-bold text-2xl shadow-2xl shadow-[#3FE0A5]/30">
            C
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
          Create account
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Get started with Creozel for free
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-start gap-3">
          <AlertCircleIcon size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <UserIcon size={18} />
            </div>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pl-12 block w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5 text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]"
              placeholder="John Doe"
            />
          </div>
        </div>

        {/* Email */}
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

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <LockIcon size={18} />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-12 pr-12 block w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5 text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]"
              placeholder="Min. 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <LockIcon size={18} />
            </div>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-12 block w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5 text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]"
              placeholder="••••••••"
            />
          </div>
        </div>

        {/* Terms */}
        <div className="flex items-center gap-2.5">
          <input
            id="terms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="h-4 w-4 text-[#3FE0A5] focus:ring-[#3FE0A5] border-gray-300 rounded cursor-pointer"
          />
          <label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            I agree to the{' '}
            <a href="#" className="font-semibold text-[#3FE0A5] hover:text-[#38B897]">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="font-semibold text-[#3FE0A5] hover:text-[#38B897]">Privacy Policy</a>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] hover:from-[#38B897] hover:to-[#3FE0A5] text-white font-semibold py-3.5 rounded-xl shadow-xl shadow-[#3FE0A5]/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              <UserPlusIcon size={18} />
              Create account
            </>
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <a href="/auth/login" className="font-semibold text-[#3FE0A5] hover:text-[#38B897] transition-colors">
          Sign in
        </a>
      </p>
    </div>
  )
}

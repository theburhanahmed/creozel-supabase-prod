import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { SparklesIcon, Loader2Icon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { authService } from '../../services/authService'
import { useAppContext } from '../../context/AppContext'
import { reportError } from '../../utils/errorReporter'

export const Onboarding: React.FC = () => {
  const navigate = useNavigate()
  const { user, setUser } = useAppContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGetStarted = async () => {
    if (!user || loading) return
    setLoading(true)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Refresh the user in AppContext so AuthGuard sees onboarding_completed = true
      const updatedUser = await authService.getCurrentUser()
      if (updatedUser) setUser(updatedUser)

      toast.success('Welcome to Creozel!')
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete onboarding'
      setError(message)
      reportError('Onboarding.handleGetStarted', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0E14] px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white font-bold text-3xl shadow-2xl shadow-[#3FE0A5]/30">
            C
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Welcome to Creozel
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Your AI-powered content automation platform is ready. Generate content, schedule posts, and grow your audience — all in one place.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            { emoji: '✨', title: 'AI Generation', desc: 'Create text, images, audio, and video scripts with AI' },
            { emoji: '📅', title: 'Smart Scheduling', desc: 'Schedule posts across all major social platforms' },
            { emoji: '📊', title: 'Analytics', desc: 'Track performance and optimize your content strategy' },
          ].map((item) => (
            <div key={item.title} className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50">
              <div className="text-2xl mb-2">{item.emoji}</div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          onClick={() => void handleGetStarted()}
          disabled={loading}
          className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-bold text-lg rounded-2xl shadow-2xl shadow-[#3FE0A5]/30 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2Icon size={22} className="animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <SparklesIcon size={22} />
              Get started
            </>
          )}
        </button>
      </div>
    </div>
  )
}

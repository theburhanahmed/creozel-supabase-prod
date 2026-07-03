import React from 'react'
import { MailIcon, ArrowLeftIcon } from 'lucide-react'

export const ConfirmSent: React.FC = () => (
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
          Check your email
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          We've sent you a confirmation link
        </p>
      </div>

      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <MailIcon size={48} className="text-[#3FE0A5]" />
        </div>
        <p className="text-gray-700 dark:text-gray-300 text-sm">
          Click the link in the email to confirm your account. If you don't see it, check your spam folder.
        </p>
        <a
          href="/auth/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#3FE0A5] hover:text-[#38B897] transition-colors"
        >
          <ArrowLeftIcon size={16} />
          Back to login
        </a>
      </div>
    </div>
  </div>
)

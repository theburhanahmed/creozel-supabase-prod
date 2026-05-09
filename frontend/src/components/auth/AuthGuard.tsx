import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * Protects routes by checking the live Supabase session.
 * Shows a spinner while the initial auth check is in flight,
 * then redirects to /auth/login if no session exists.
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, isAuthLoading } = useAppContext()

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0A0E14]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white font-bold text-2xl shadow-2xl animate-pulse">
            C
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#3FE0A5]" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  return <>{children}</>
}

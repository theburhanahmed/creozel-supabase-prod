import React from 'react'
import { LoginForm } from '../../components/auth/LoginForm'

export const Login: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0E14] px-4 py-12">
    <LoginForm />
  </div>
)

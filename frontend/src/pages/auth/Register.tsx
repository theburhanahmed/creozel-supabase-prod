import React from 'react'
import { RegisterForm } from '../../components/auth/RegisterForm'

export const Register: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0E14] px-4 py-12">
    <RegisterForm />
  </div>
)

import React from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'neon'
  size?: 'sm' | 'md' | 'lg'
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  loading?: boolean
  href?: string
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  disabled,
  className = '',
  href,
  ...props
}) => {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'

  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white hover:brightness-105 shadow-md hover:shadow-lg focus-visible:ring-[#3FE0A5]',
    secondary: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700',
    outline: 'border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
    ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
    destructive: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:brightness-105 shadow-md',
    neon: 'bg-[#3FE0A5] text-white shadow-lg shadow-[#3FE0A5]/30 hover:shadow-xl hover:shadow-[#3FE0A5]/40',
  }

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  }

  const classes = cn(base, variants[variant], sizes[size], className)

  const content = loading ? (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      {children}
    </div>
  ) : (
    <>
      {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </>
  )

  if (href) return <Link to={href} className={classes}>{content}</Link>

  return (
    <button className={classes} disabled={loading || disabled} {...props}>
      {content}
    </button>
  )
}

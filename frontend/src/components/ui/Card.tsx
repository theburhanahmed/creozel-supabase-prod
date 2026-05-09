import React, { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  href?: string
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, onClick, href, ...props }, ref) => {
    const base = cn(
      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden transition-all duration-200',
      className,
    )
    if (href) return <Link to={href} className={cn(base, 'hover:shadow-md hover:-translate-y-0.5')}>{children}</Link>
    if (onClick) return <div ref={ref} className={cn(base, 'cursor-pointer hover:shadow-md hover:-translate-y-0.5')} onClick={onClick} {...props}>{children}</div>
    return <div ref={ref} className={base} {...props}>{children}</div>
  },
)
Card.displayName = 'Card'

export const CardHeader: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('px-6 py-4 border-b border-gray-200 dark:border-gray-700', className)}>{children}</div>
)

export const CardContent: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('px-6 py-5', className)}>{children}</div>
)

export const CardFooter: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('px-6 py-4 border-t border-gray-200 dark:border-gray-700', className)}>{children}</div>
)

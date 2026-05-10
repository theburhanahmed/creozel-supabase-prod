import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRightIcon, HomeIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface BreadcrumbsProps {
  autoGenerate?: boolean
  className?: string
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ autoGenerate = false, className = '' }) => {
  const location = useLocation()

  if (!autoGenerate || !location) return null

  const paths = location.pathname.split('/').filter(Boolean)
  if (paths.length === 0) return null

  const crumbs = [{ label: 'Home', href: '/' }]
  let current = ''
  paths.forEach((p) => {
    current += `/${p}`
    crumbs.push({
      label: p.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      href: current,
    })
  })

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4', className)}>
      <ol className="flex items-center gap-2 text-sm">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-2">
            {i > 0 && <ChevronRightIcon size={14} className="text-gray-400" />}
            {i === 0 ? (
              <Link to="/" className="text-gray-400 hover:text-[#3FE0A5] transition-colors" aria-label="Home">
                <HomeIcon size={14} />
              </Link>
            ) : i === crumbs.length - 1 ? (
              <span className="font-medium text-gray-900 dark:text-white" aria-current="page">{crumb.label}</span>
            ) : (
              <Link to={crumb.href} className="text-gray-500 hover:text-[#3FE0A5] transition-colors">{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

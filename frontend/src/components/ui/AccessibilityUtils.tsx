import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface FocusTrapProps {
  children: React.ReactNode
  isActive: boolean
  onEscape?: () => void
}

export const FocusTrap: React.FC<FocusTrapProps> = ({ children, isActive, onEscape }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return
    const focusable = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) { e.preventDefault(); onEscape(); return }
      if (e.key === 'Tab') {
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last?.focus() } }
        else { if (document.activeElement === last) { e.preventDefault(); first?.focus() } }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    const prev = document.activeElement as HTMLElement
    return () => { document.removeEventListener('keydown', handleKeyDown); prev?.focus() }
  }, [isActive, onEscape])

  return <div ref={containerRef}>{children}</div>
}

interface PortalProps { children: React.ReactNode; container?: HTMLElement }
export const Portal: React.FC<PortalProps> = ({ children, container }) => {
  const target = container ?? (typeof document !== 'undefined' ? document.body : null)
  return target ? createPortal(children, target) : null
}

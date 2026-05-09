import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PlusIcon, XIcon, FileTextIcon, ImageIcon, VideoIcon, MicIcon, RocketIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

const actions = [
  { icon: <FileTextIcon size={18} />, label: 'Text Content', href: '/content/text', color: 'from-blue-500 to-cyan-500' },
  { icon: <ImageIcon size={18} />, label: 'Image Content', href: '/content/image', color: 'from-purple-500 to-pink-500' },
  { icon: <VideoIcon size={18} />, label: 'Video Content', href: '/content/video', color: 'from-orange-500 to-red-500' },
  { icon: <MicIcon size={18} />, label: 'Audio Content', href: '/content/audio', color: 'from-amber-500 to-yellow-500' },
  { icon: <RocketIcon size={18} />, label: 'New Pipeline', href: '/autopilot/create', color: 'from-indigo-500 to-violet-500' },
]

export const FloatingActionMenu: React.FC<{ position?: string }> = () => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc) }
  }, [isOpen])

  return (
    <div ref={ref}>
      <motion.button
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-[var(--z-fixed)] bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-gradient-to-r from-[#3FE0A5] to-[#38B897] shadow-xl neon-green flex items-center justify-center text-white focus:outline-none focus:ring-4 focus:ring-[#3FE0A5]/30"
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={isOpen}
      >
        <AnimatePresence mode="wait">
          {isOpen
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><XIcon size={22} /></motion.div>
            : <motion.div key="plus" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><PlusIcon size={22} /></motion.div>
          }
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[var(--z-sticky)]" onClick={() => setIsOpen(false)} />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed z-[var(--z-fixed)] bottom-36 right-4 md:bottom-24 md:right-6 flex flex-col gap-3"
            >
              {actions.map((action, i) => (
                <motion.div key={action.label}
                  initial={{ scale: 0, x: 20, opacity: 0 }} animate={{ scale: 1, x: 0, opacity: 1 }} exit={{ scale: 0, x: 20, opacity: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2, ease: [0.165, 0.84, 0.44, 1] }}
                >
                  <Link to={action.href} onClick={() => setIsOpen(false)}
                    className="group flex items-center gap-3 glass px-4 py-3 rounded-2xl shadow-ios-lg hover:shadow-ios-xl transition-all duration-300 border border-white/10 dark:border-gray-700/30 min-w-[200px]"
                  >
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br text-white flex-shrink-0 shadow-ios-sm', action.color)}>
                      {action.icon}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#3FE0A5] transition-colors">
                      {action.label}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

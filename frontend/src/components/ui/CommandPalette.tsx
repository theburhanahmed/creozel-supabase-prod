import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { SearchIcon, FileTextIcon, ImageIcon, VideoIcon, MicIcon, RocketIcon, BarChart2Icon, CalendarIcon, SettingsIcon, HomeIcon, ArrowRightIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface CommandItem {
  id: string; title: string; description?: string; icon: React.ReactNode
  action: () => void; category: string; keywords?: string[]
}

interface CommandPaletteProps { isOpen: boolean; onClose: () => void }

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: CommandItem[] = useMemo(() => [
    { id: 'home', title: 'Home', description: 'Go to dashboard', icon: <HomeIcon size={18} />, action: () => navigate('/'), category: 'navigation', keywords: ['dashboard'] },
    { id: 'autopilot', title: 'Autopilot', description: 'Content automation', icon: <RocketIcon size={18} />, action: () => navigate('/autopilot'), category: 'navigation', keywords: ['pipeline', 'automation'] },
    { id: 'analytics', title: 'Analytics', description: 'Performance metrics', icon: <BarChart2Icon size={18} />, action: () => navigate('/analytics'), category: 'navigation', keywords: ['stats', 'metrics'] },
    { id: 'calendar', title: 'Calendar', description: 'Schedule content', icon: <CalendarIcon size={18} />, action: () => navigate('/calendar'), category: 'navigation', keywords: ['schedule', 'posts'] },
    { id: 'settings', title: 'Settings', description: 'App preferences', icon: <SettingsIcon size={18} />, action: () => navigate('/settings'), category: 'navigation' },
    { id: 'text', title: 'Text Editor', description: 'Generate text content', icon: <FileTextIcon size={18} />, action: () => navigate('/content/text'), category: 'tools', keywords: ['write', 'blog'] },
    { id: 'image', title: 'Image Generator', description: 'Create AI images', icon: <ImageIcon size={18} />, action: () => navigate('/content/image'), category: 'tools', keywords: ['picture', 'art'] },
    { id: 'video', title: 'Video Creator', description: 'Generate videos', icon: <VideoIcon size={18} />, action: () => navigate('/content/video'), category: 'tools', keywords: ['clip'] },
    { id: 'audio', title: 'Audio Studio', description: 'Create audio content', icon: <MicIcon size={18} />, action: () => navigate('/content/audio'), category: 'tools', keywords: ['voice', 'music'] },
  ], [navigate])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.keywords?.some((k) => k.includes(q))
    )
  }, [query, commands])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((p) => (p < filtered.length - 1 ? p + 1 : 0)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((p) => (p > 0 ? p - 1 : filtered.length - 1)) }
      if (e.key === 'Enter') { e.preventDefault(); filtered[selectedIndex]?.action(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, selectedIndex, filtered, onClose])

  useEffect(() => { if (isOpen) { inputRef.current?.focus() } else { setQuery(''); setSelectedIndex(0) } }, [isOpen])

  const grouped = useMemo(() => {
    const g: Record<string, CommandItem[]> = {}
    filtered.forEach((c) => { if (!g[c.category]) g[c.category] = []; g[c.category].push(c) })
    return g
  }, [filtered])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[20vh] px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl glass-enhanced rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                <SearchIcon size={20} className="text-gray-400 flex-shrink-0" />
                <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search commands, tools, pages..." className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 text-base" />
                <kbd className="hidden sm:flex px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">ESC</kbd>
              </div>
              <div className="max-h-96 overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No results for "{query}"</div>
                ) : (
                  Object.entries(grouped).map(([cat, items]) => (
                    <div key={cat} className="mb-3">
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{cat}</div>
                      {items.map((item) => {
                        const idx = filtered.indexOf(item)
                        const active = idx === selectedIndex
                        return (
                          <motion.button key={item.id} onClick={() => { item.action(); onClose() }}
                            onMouseEnter={() => setSelectedIndex(idx)} whileHover={{ x: 2 }}
                            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors', active ? 'bg-[#3FE0A5]/10 text-[#3FE0A5]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800')}
                          >
                            <span className={active ? 'text-[#3FE0A5]' : 'text-gray-400'}>{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{item.title}</div>
                              {item.description && <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>}
                            </div>
                            {active && <ArrowRightIcon size={14} className="text-[#3FE0A5]" />}
                          </motion.button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-xs text-gray-400">
                <div className="flex gap-4">
                  <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">↑↓</kbd> Navigate</span>
                  <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">↵</kbd> Select</span>
                </div>
                <span>⌘K to open</span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setIsOpen((p) => !p) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  return { isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }
}

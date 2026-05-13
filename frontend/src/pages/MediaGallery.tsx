import React, { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { UploadIcon, TrashIcon, ImageIcon, VideoIcon, MicIcon, FileIcon, SearchIcon, FilterIcon } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { getMediaItems, uploadMediaItem, deleteMediaItem } from '../services/mediaService'
import type { MediaItem, MediaType } from '../types'

const TYPE_ICONS: Record<MediaType, React.ReactNode> = {
  image:    <ImageIcon size={20} />,
  video:    <VideoIcon size={20} />,
  audio:    <MicIcon size={20} />,
  document: <FileIcon size={20} />,
}

const TYPE_COLORS: Record<MediaType, string> = {
  image:    'bg-pink-100 dark:bg-pink-900/30 text-pink-600',
  video:    'bg-red-100 dark:bg-red-900/30 text-red-600',
  audio:    'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
  document: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export const MediaGallery: React.FC = () => {
  const { user, activeTeam } = useAppContext()
  const [items, setItems]         = useState<MediaItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState<MediaType | 'all'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Task 7.3: Clear items and show loading skeleton when activeTeam changes
  useEffect(() => {
    setItems([])
    setLoading(true)
  }, [activeTeam])

  // Task 7.1: Pass activeTeam?.id ?? null as teamId; depends on both user and activeTeam
  useEffect(() => {
    if (user) {
      void getMediaItems(user.id, activeTeam?.id ?? null).then((data) => {
        setItems(data)
        setLoading(false)
      })
    }
  }, [user, activeTeam])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    // Task 7.1: Pass activeTeam?.id ?? null as teamId
    const item = await uploadMediaItem(user.id, file, activeTeam?.id ?? null)
    setUploading(false)
    if (item) { setItems((prev) => [item, ...prev]); toast.success('File uploaded') }
    else toast.error('Upload failed')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (item: MediaItem) => {
    const ok = await deleteMediaItem(item)
    if (ok) { setItems((prev) => prev.filter((i) => i.id !== item.id)); toast.success('Deleted') }
    else toast.error('Delete failed')
  }

  const filtered = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchesType   = typeFilter === 'all' || item.type === typeFilter
    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-6">
      <div className="glass-enhanced rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {activeTeam ? `${activeTeam.name} — Media Library` : 'Personal — Media Library'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{items.length} assets</p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={(e) => void handleUpload(e)} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
            <UploadIcon size={16} />
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files…"
            className="w-full pl-9 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3FE0A5]/20 focus:border-[#3FE0A5]" />
        </div>
        <div className="flex gap-2">
          {(['all', 'image', 'video', 'audio', 'document'] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${typeFilter === t ? 'bg-[#3FE0A5] text-white' : 'glass-light text-gray-600 dark:text-gray-400 hover:glass'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1,2,3,4,5,6].map((i) => <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl aspect-square" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-enhanced rounded-2xl p-12 text-center">
          <ImageIcon size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">{search || typeFilter !== 'all' ? 'No files match your filters' : 'No media yet. Upload files or generate content.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="glass-enhanced rounded-2xl overflow-hidden group relative">
              {item.type === 'image' && item.public_url ? (
                <img src={item.public_url} alt={item.name} className="w-full aspect-square object-cover" />
              ) : (
                <div className={`w-full aspect-square flex items-center justify-center ${TYPE_COLORS[item.type]}`}>
                  {TYPE_ICONS[item.type]}
                </div>
              )}
              <div className="p-3">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(item.size_bytes)}</p>
              </div>
              <button onClick={() => void handleDelete(item)}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete">
                <TrashIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

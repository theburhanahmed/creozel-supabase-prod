import React, { useEffect, useState, useCallback, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventInput, EventDropArg } from '@fullcalendar/core'
import { toast } from 'sonner'
import {
  XIcon,
  CalendarIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  InstagramIcon,
  YoutubeIcon,
  TwitterIcon,
  LinkedinIcon,
  FacebookIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import { getScheduledPosts, reschedulePost } from '../services/calendarService'
import type { ScheduledPost, SocialPlatform } from '../types'

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<
  SocialPlatform,
  { color: string; bgColor: string; icon: React.ReactNode; label: string }
> = {
  instagram: {
    color: '#E1306C',
    bgColor: '#fce7f3',
    icon: <InstagramIcon size={14} />,
    label: 'Instagram',
  },
  youtube: {
    color: '#FF0000',
    bgColor: '#fee2e2',
    icon: <YoutubeIcon size={14} />,
    label: 'YouTube',
  },
  twitter: {
    color: '#1DA1F2',
    bgColor: '#e0f2fe',
    icon: <TwitterIcon size={14} />,
    label: 'Twitter / X',
  },
  facebook: {
    color: '#1877F2',
    bgColor: '#dbeafe',
    icon: <FacebookIcon size={14} />,
    label: 'Facebook',
  },
  linkedin: {
    color: '#0A66C2',
    bgColor: '#dbeafe',
    icon: <LinkedinIcon size={14} />,
    label: 'LinkedIn',
  },
  tiktok: {
    color: '#010101',
    bgColor: '#f3f4f6',
    icon: <span className="text-xs font-bold">TT</span>,
    label: 'TikTok',
  },
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '',       // uses platform color
  published: '#10b981',
  failed:    '#ef4444',
  draft:     '#9ca3af',
}

// ─── Post Detail Modal ────────────────────────────────────────────────────────
interface PostModalProps {
  post: ScheduledPost
  onClose: () => void
}

const PostModal: React.FC<PostModalProps> = ({ post, onClose }) => {
  const platform = PLATFORM_CONFIG[post.platform]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Post details"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative glass-enhanced rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: platform.color }}
            >
              {platform.icon}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {platform.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(post.scheduled_at).toLocaleString(undefined, {
                  weekday: 'short',
                  month:   'short',
                  day:     'numeric',
                  hour:    '2-digit',
                  minute:  '2-digit',
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl glass-light hover:glass transition-colors"
            aria-label="Close"
          >
            <XIcon size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Status badge */}
        <div className="mb-4">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              post.status === 'published'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : post.status === 'failed'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : post.status === 'scheduled'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
          </span>
        </div>

        {/* Content */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {post.content}
          </p>
        </div>

        {/* Media */}
        {post.media_urls && post.media_urls.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {post.media_urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#3FE0A5] hover:underline"
              >
                <ExternalLinkIcon size={12} />
                Media {i + 1}
              </a>
            ))}
          </div>
        )}

        {/* Error message */}
        {post.status === 'failed' && post.error_message && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <AlertCircleIcon size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300">{post.error_message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
export const Calendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null)
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getScheduledPosts()
      setPosts(data)
    } catch {
      setError('Failed to load scheduled posts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  // Convert posts to FullCalendar events
  const events: EventInput[] = posts.map((post) => {
    const platform = PLATFORM_CONFIG[post.platform]
    const isFailed = post.status === 'failed'
    const color = isFailed ? STATUS_COLORS.failed : platform.color

    return {
      id:              post.id,
      title:           `${platform.label}: ${post.content.slice(0, 30)}${post.content.length > 30 ? '…' : ''}`,
      start:           post.scheduled_at,
      backgroundColor: color,
      borderColor:     color,
      textColor:       '#ffffff',
      extendedProps:   { post },
    }
  })

  const handleEventClick = useCallback((info: EventClickArg) => {
    const post = info.event.extendedProps.post as ScheduledPost
    setSelectedPost(post)
  }, [])

  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const post = info.event.extendedProps.post as ScheduledPost
    const newDate = info.event.start

    if (!newDate) {
      info.revert()
      return
    }

    const updated = await reschedulePost(post.id, newDate.toISOString())
    if (!updated) {
      info.revert()
      toast.error('Failed to reschedule post')
    } else {
      toast.success('Post rescheduled')
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, scheduled_at: newDate.toISOString() } : p,
        ),
      )
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-enhanced rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Content Calendar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {posts.length} post{posts.length !== 1 ? 's' : ''} scheduled
          </p>
        </div>
        <button
          onClick={() => void loadPosts()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 glass-light rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:glass transition-colors disabled:opacity-50"
        >
          <RefreshCwIcon size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Platform legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {(Object.entries(PLATFORM_CONFIG) as Array<[SocialPlatform, typeof PLATFORM_CONFIG[SocialPlatform]]>).map(
          ([platform, config]) => (
            <div key={platform} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {config.label}
              </span>
            </div>
          ),
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Failed</span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-enhanced rounded-2xl p-4 flex items-center gap-3 border border-red-200 dark:border-red-800/30">
          <AlertCircleIcon size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
          <button
            onClick={() => void loadPosts()}
            className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            <RefreshCwIcon size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Calendar */}
      <div className="glass-enhanced rounded-2xl p-4 overflow-hidden">
        {loading && posts.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-[#3FE0A5]/30 border-t-[#3FE0A5] animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading calendar…
              </p>
            </div>
          </div>
        ) : (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left:   'prev,next today',
              center: 'title',
              right:  'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={events}
            editable={true}
            droppable={true}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            height="auto"
            eventDisplay="block"
            dayMaxEvents={3}
            moreLinkClick="popover"
            nowIndicator={true}
            buttonText={{
              today: 'Today',
              month: 'Month',
              week:  'Week',
              day:   'Day',
            }}
            eventContent={(arg) => (
              <div className="px-1 py-0.5 truncate text-xs font-medium">
                {arg.event.title}
              </div>
            )}
          />
        )}
      </div>

      {/* Post detail modal */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && !error && (
        <div className="glass-enhanced rounded-2xl p-12 text-center">
          <CalendarIcon size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No posts scheduled
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Create content and schedule it to see it here.
          </p>
        </div>
      )}
    </div>
  )
}

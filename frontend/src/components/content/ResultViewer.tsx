import React, { useEffect, useState } from 'react'
import type { ContentJob } from '../../types'

// ─── TextResultViewer ───────────────────────────────────────────────────────��[...]

interface TextResultViewerProps {
  job: ContentJob
}

export const TextResultViewer: React.FC<TextResultViewerProps> = ({ job }) => {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!job.result_url) return
    setLoading(true)
    setText(null)
    setError(false)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    fetch(job.result_url, { signal: controller.signal })
      .then((res) => res.text())
      .then((t) => {
        setText(t)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setText(null)
        setLoading(false)
      })
      .finally(() => clearTimeout(timeoutId))

    return () => {
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [job.result_url])

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 max-h-64 overflow-y-auto">
        <p className="text-sm text-gray-400 animate-pulse">Loading content…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 max-h-64 overflow-y-auto space-y-2">
        <p className="text-sm text-red-500 dark:text-red-400">Failed to load content.</p>
        <a
          href={job.result_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-500 hover:underline"
        >
          View content ↗
        </a>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 max-h-64 overflow-y-auto">
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
        {text ?? 'Content generated successfully.'}
      </p>
    </div>
  )
}

// ─── ImageResultViewer ───────────────────────────────────────────────────────[...]

interface ImageResultViewerProps {
  job: ContentJob
}

export const ImageResultViewer: React.FC<ImageResultViewerProps> = ({ job }) => {
  const altText = job.prompt.slice(0, 100)

  return (
    <div className="space-y-3">
      <img
        src={job.result_url}
        alt={altText}
        className="w-full rounded-xl object-cover max-h-96"
      />
    </div>
  )
}

// ─── AudioResultViewer ───────────────────────────────────────────────────────[...]

interface AudioResultViewerProps {
  job: ContentJob
}

export const AudioResultViewer: React.FC<AudioResultViewerProps> = ({ job }) => {
  return (
    <div className="space-y-3">
      <audio controls className="w-full" src={job.result_url}>
        Your browser does not support audio playback.
      </audio>
    </div>
  )
}

// ─── VideoResultViewer ──────────────────────────────────────────────────────��[...]

interface VideoResultViewerProps {
  job: ContentJob
}

export const VideoResultViewer: React.FC<VideoResultViewerProps> = ({ job }) => {
  // If result_url points to an .mp4 / .webm, render a native video player.
  // Otherwise (legacy text-script jobs) fall back to the text viewer.
  const isVideoFile =
    job.result_url != null &&
    /\.(mp4|webm|mov)(\?|$)/i.test(job.result_url)

  if (isVideoFile) {
    return (
      <div className="space-y-3">
        <video
          controls
          playsInline
          className="w-full rounded-xl max-h-96 bg-black"
          src={job.result_url}
          aria-label="Generated video"
        >
          {/* Provide a captions track if available to satisfy accessibility checks. */}
          <track
            kind="captions"
            src={`${job.result_url}.vtt`}
            srcLang="en"
            label="English captions"
          />
          Your browser does not support video playback.
        </video>
        <a
          href={job.result_url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[#3FE0A5] hover:underline"
        >
          ↓ Download video
        </a>
      </div>
    )
  }

  // Legacy: video job produced a text script — render as text
  return <TextResultViewer job={job} />
}

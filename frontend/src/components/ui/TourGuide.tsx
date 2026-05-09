import React from 'react'

export interface TourStep { target: string; title: string; content: string; position?: 'top' | 'right' | 'bottom' | 'left' }

interface TourGuideProps {
  steps: TourStep[]
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

// Lightweight stub — replace with full implementation when needed
export const TourGuide: React.FC<TourGuideProps> = ({ isOpen, onClose, onComplete, steps }) => {
  if (!isOpen || steps.length === 0) return null
  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="absolute bottom-8 right-8 pointer-events-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5 max-w-xs">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{steps[0].title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{steps[0].content}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Skip</button>
          <button onClick={() => { onComplete?.(); onClose() }} className="flex-1 py-2 text-sm text-white bg-gradient-to-r from-[#3FE0A5] to-[#38B897] rounded-xl">Got it</button>
        </div>
      </div>
    </div>
  )
}

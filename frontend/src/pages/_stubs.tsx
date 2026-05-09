/**
 * Stub pages — placeholder for pages not yet implemented.
 * All MVP pages have been replaced with real implementations.
 * This file is kept for any future stub needs.
 */
import React from 'react'

const Stub: React.FC<{ name: string }> = ({ name }) => (
  <div className="glass-enhanced rounded-2xl p-8 text-center">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{name}</h2>
    <p className="text-gray-500 dark:text-gray-400">
      This page is coming soon.
    </p>
  </div>
)

// All MVP pages are now implemented. This file is intentionally minimal.
export const ComingSoon: React.FC<{ name: string }> = ({ name }) => <Stub name={name} />

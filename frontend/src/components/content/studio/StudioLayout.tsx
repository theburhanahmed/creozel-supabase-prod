import React from 'react'

interface StudioLayoutProps {
  configPanel: React.ReactNode
  outputPanel: React.ReactNode
}

/**
 * Two-panel responsive wrapper for the Content Generation Studio.
 *
 * Layout behaviour:
 * - At >= 1024 px (lg breakpoint): side-by-side, each panel min-width 300 px.
 * - Below 1024 px: stacked, configPanel on top, outputPanel below.
 */
export const StudioLayout: React.FC<StudioLayoutProps> = ({ configPanel, outputPanel }) => {
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* Configuration Panel — left on desktop, top on mobile */}
      <div
        className="w-full lg:flex-1 min-w-0"
        style={{ minWidth: '300px' }}
      >
        {configPanel}
      </div>

      {/* Output Panel — right on desktop, bottom on mobile */}
      <div
        className="w-full lg:flex-1 min-w-0"
        style={{ minWidth: '300px' }}
      >
        {outputPanel}
      </div>
    </div>
  )
}

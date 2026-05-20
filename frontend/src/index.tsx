import './index.css'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import { App } from './App'

inject()

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

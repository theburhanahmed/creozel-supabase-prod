import React, { Component } from 'react'
import { AlertTriangleIcon, RefreshCwIcon, HomeIcon } from 'lucide-react'

interface Props { children: React.ReactNode; fallback?: React.ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null } }

  static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0E14] p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangleIcon size={32} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Something went wrong</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">An unexpected error occurred. Your data is safe.</p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold py-2.5 rounded-xl"
            >
              <RefreshCwIcon size={16} /> Try Again
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-xl"
            >
              <HomeIcon size={16} /> Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}

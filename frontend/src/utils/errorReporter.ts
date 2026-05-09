/**
 * Centralised error/warning reporting.
 *
 * In development: logs to the console.
 * In production: forwards to Sentry (when configured) and suppresses console noise.
 *
 * Usage:
 *   import { reportError, reportWarning } from '@/utils/errorReporter'
 *
 *   catch (error: unknown) {
 *     reportError('dashboardService.getStats', error)
 *   }
 */

type ErrorContext = Record<string, unknown>

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  return new Error(typeof value === 'string' ? value : JSON.stringify(value))
}

/**
 * Report an unexpected error. Use in catch blocks.
 */
export function reportError(
  location: string,
  error: unknown,
  context?: ErrorContext,
): void {
  const err = toError(error)

  if (import.meta.env.DEV) {
    console.error(`[Creozel Error] ${location}:`, err, context ?? '')
  }

  // Forward to Sentry in production when available
  if (import.meta.env.PROD) {
    try {
      // Sentry is loaded via CDN or npm — check window.Sentry as a fallback
      const sentry = (window as unknown as { Sentry?: { captureException: (e: Error, ctx?: unknown) => void } }).Sentry
      if (sentry) {
        sentry.captureException(err, { extra: { location, ...context } })
      }
    } catch {
      // Sentry not available — fail silently
    }
  }
}

/**
 * Report a non-fatal warning. Use for degraded-but-recoverable states.
 */
export function reportWarning(
  location: string,
  message: string,
  context?: ErrorContext,
): void {
  if (import.meta.env.DEV) {
    console.warn(`[Creozel Warning] ${location}: ${message}`, context ?? '')
  }

  if (import.meta.env.PROD) {
    try {
      const sentry = (window as unknown as { Sentry?: { captureMessage: (m: string, ctx?: unknown) => void } }).Sentry
      if (sentry) {
        sentry.captureMessage(`${location}: ${message}`, { extra: context })
      }
    } catch {
      // Sentry not available — fail silently
    }
  }
}

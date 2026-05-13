import React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangleIcon, Loader2Icon, WalletIcon, ZapIcon } from 'lucide-react'

/**
 * Props for CreditEstimateBar.
 *
 * Matches the interface defined in design.md §Props Interfaces.
 */
export interface CreditEstimateBarProps {
  /** Estimated credit cost for the current configuration, or null when unavailable. */
  estimatedCost: number | null
  /** User's current credit balance, or null when unavailable. */
  balance: number | null
  /** True while the credit estimate is being fetched/recalculated. */
  isLoading: boolean
  /** True when the pricing fetch failed and no estimate can be shown. */
  isUnavailable: boolean
}

/**
 * CreditEstimateBar
 *
 * Displays the estimated generation cost and the user's current credit balance
 * at the bottom of the Configuration Panel.
 *
 * Behaviour:
 * - While `isLoading` is true: shows a spinner in place of the cost figure.
 * - When `isUnavailable` is true: shows "Cost estimate unavailable".
 * - Otherwise: shows the cost to two decimal places (e.g. "3.50 credits").
 * - Always shows the balance in "{balance} credits available" format when
 *   `balance` is non-null.
 * - When `estimatedCost > balance`: shows an inline warning and a
 *   "Top Up Credits" link navigating to `/credits/add`.
 * - When balance is sufficient: warning is hidden (Req 9.6).
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */
export const CreditEstimateBar: React.FC<CreditEstimateBarProps> = ({
  estimatedCost,
  balance,
  isLoading,
  isUnavailable,
}) => {
  // Determine whether the user has insufficient credits.
  // Only show the warning when both values are known and cost exceeds balance.
  const isInsufficientBalance =
    !isLoading &&
    !isUnavailable &&
    estimatedCost !== null &&
    balance !== null &&
    estimatedCost > balance

  return (
    <div
      className={[
        // Container: glass-light card matching other studio panels
        'rounded-xl border px-4 py-3 flex flex-col gap-2',
        'bg-white/60 dark:bg-white/5 backdrop-blur-sm',
        isInsufficientBalance
          ? 'border-amber-400/60 dark:border-amber-500/40'
          : 'border-white/20 dark:border-white/10',
        'transition-colors duration-200',
      ].join(' ')}
      aria-label="Credit estimate"
    >
      {/* ── Top row: cost estimate + balance ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: estimated cost */}
        <div className="flex items-center gap-2">
          <ZapIcon
            size={15}
            aria-hidden="true"
            className="shrink-0 text-[#3FE0A5]"
          />

          {isLoading ? (
            /* Loading state — spinner replaces the cost figure (Req 9.2) */
            <span
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
              aria-live="polite"
              aria-label="Calculating credit estimate"
            >
              <Loader2Icon
                size={14}
                aria-hidden="true"
                className="animate-spin shrink-0"
              />
              <span>Calculating…</span>
            </span>
          ) : isUnavailable ? (
            /* Unavailable state (Req 9.3) */
            <span
              className="text-sm text-gray-400 dark:text-gray-500 italic"
              aria-live="polite"
            >
              Cost estimate unavailable
            </span>
          ) : (
            /* Normal state — cost to 2 d.p. (Req 9.1) */
            <span
              className="text-sm font-semibold text-gray-800 dark:text-gray-100"
              aria-live="polite"
              aria-label={`Estimated cost: ${estimatedCost !== null ? estimatedCost.toFixed(2) : '—'} credits`}
            >
              {estimatedCost !== null ? (
                <>
                  <span className="text-[#3FE0A5]">{estimatedCost.toFixed(2)}</span>
                  {' '}
                  <span className="font-normal text-gray-500 dark:text-gray-400">credits</span>
                </>
              ) : (
                <span className="text-gray-400 dark:text-gray-500 italic font-normal">
                  Cost estimate unavailable
                </span>
              )}
            </span>
          )}
        </div>

        {/* Right: current balance (Req 9.4) */}
        {balance !== null && (
          <div className="flex items-center gap-1.5">
            <WalletIcon
              size={14}
              aria-hidden="true"
              className="shrink-0 text-gray-400 dark:text-gray-500"
            />
            <span
              className="text-xs text-gray-500 dark:text-gray-400"
              aria-label={`Current balance: ${balance} credits available`}
            >
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {balance}
              </span>
              {' credits available'}
            </span>
          </div>
        )}
      </div>

      {/* ── Insufficient balance warning (Req 9.5) ───────────────────────── */}
      {isInsufficientBalance && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 flex-wrap"
        >
          {/* Warning message */}
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangleIcon size={13} aria-hidden="true" className="shrink-0" />
            Insufficient credits — you need{' '}
            <span className="font-semibold">
              {estimatedCost !== null && balance !== null
                ? (estimatedCost - balance).toFixed(2)
                : ''}
            </span>{' '}
            more to generate.
          </p>

          {/* Top Up Credits link (Req 9.5) */}
          <Link
            to="/credits/add"
            className={[
              'shrink-0 text-xs font-semibold px-3 py-1 rounded-lg',
              'bg-amber-500/10 text-amber-700 dark:text-amber-300',
              'border border-amber-400/40 dark:border-amber-500/30',
              'hover:bg-amber-500/20 transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-amber-400 focus-visible:ring-offset-1',
            ].join(' ')}
            aria-label="Top up your credits"
          >
            Top Up Credits
          </Link>
        </div>
      )}
    </div>
  )
}

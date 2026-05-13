import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CreditCardIcon, Loader2Icon, AlertTriangleIcon, FlaskConicalIcon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { getCreditPacks, getWallet } from '../../services/creditsService'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../utils/errorReporter'
import type { DodoProduct, Wallet } from '../../types'

// ─── Types ────────────────────────────────────────────────────────────────────

type PurchaseState = 'idle' | 'loading' | 'redirecting' | 'error'

interface AddCreditsState {
  packs: DodoProduct[]
  packsLoading: boolean
  wallet: Wallet | null
  purchaseState: PurchaseState
  purchasingId: string | null
}

// ─── Env flags ────────────────────────────────────────────────────────────────

const DODO_ENABLED = import.meta.env.VITE_DODO_PAYMENTS_ENABLED === 'true'
const DODO_ENV = import.meta.env.VITE_DODO_PAYMENTS_ENVIRONMENT as string | undefined
const IS_SANDBOX = DODO_ENV === 'test_mode'

// ─── Component ────────────────────────────────────────────────────────────────

export const AddCredits: React.FC = () => {
  const { user } = useAppContext()
  const [searchParams] = useSearchParams()

  const [state, setState] = useState<AddCreditsState>({
    packs: [],
    packsLoading: true,
    wallet: null,
    purchaseState: 'idle',
    purchasingId: null,
  })

  // ─── Fetch wallet helper ───────────────────────────────────────────────────

  const fetchWallet = async () => {
    if (!user) return
    try {
      const w = await getWallet(user.id)
      setState((prev) => ({ ...prev, wallet: w }))
    } catch (error: unknown) {
      reportError('AddCredits.fetchWallet', error)
    }
  }

  // ─── On mount: load packs + wallet in parallel; handle ?status param ───────

  useEffect(() => {
    if (!user) return

    void (async () => {
      const [packs, wallet] = await Promise.all([
        getCreditPacks(),
        getWallet(user.id),
      ])
      setState((prev) => ({
        ...prev,
        packs,
        packsLoading: false,
        wallet,
      }))
    })()

    const status = searchParams.get('status')
    if (status === 'success') {
      toast.success('Payment received! Credits will be added to your account shortly.')
      // Re-fetch wallet after a short delay to pick up webhook-credited balance
      setTimeout(() => { void fetchWallet() }, 2000)
    } else if (status === 'cancelled') {
      toast.info('Checkout cancelled. No charges were made.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ─── Purchase handler ──────────────────────────────────────────────────────

  const handlePurchase = async (pack: DodoProduct) => {
    if (!user || !state.wallet) return

    setState((prev) => ({
      ...prev,
      purchaseState: 'loading',
      purchasingId: pack.product_id,
    }))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          product_id: pack.product_id,
          user_id: user.id,
          wallet_id: state.wallet.id,
        },
      })

      clearTimeout(timeoutId)

      if (error || !data?.checkout_url) {
        throw new Error(error?.message ?? 'No checkout URL returned')
      }

      setState((prev) => ({ ...prev, purchaseState: 'redirecting' }))
      window.location.href = data.checkout_url as string
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      reportError('AddCredits.handlePurchase', error)
      toast.error('Failed to start checkout. Please try again.')
      setState((prev) => ({
        ...prev,
        purchaseState: 'error',
        purchasingId: null,
      }))
    }
  }

  // ─── Test top-up handler ───────────────────────────────────────────────────

  const handleTestTopup = async () => {
    if (!user || !state.wallet) return
    try {
      const { error } = await supabase.functions.invoke('admin-topup', {
        body: { amount: 100, description: 'Test credit grant' },
      })
      if (error) throw new Error(error.message)
      toast.success('100 test credits added!')
      await fetchWallet()
    } catch (error: unknown) {
      reportError('AddCredits.handleTestTopup', error)
      toast.error('Failed to add test credits.')
    }
  }

  // ─── Derived state ─────────────────────────────────────────────────────────

  const isPurchasing = state.purchaseState === 'loading' || state.purchaseState === 'redirecting'
  const buttonsDisabled = !DODO_ENABLED || isPurchasing

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="glass-enhanced rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Credits</h1>
          {IS_SANDBOX && (
            <span className="inline-flex items-center gap-1.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 text-xs font-bold px-2.5 py-1 rounded-full">
              <FlaskConicalIcon size={12} />
              Sandbox Mode
            </span>
          )}
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Current balance:{' '}
          <span className="font-semibold text-[#3FE0A5]">
            {state.wallet?.balance ?? 0} credits
          </span>
        </p>
      </div>

      {/* Configuration warning — non-dismissible */}
      {!DODO_ENABLED && (
        <div className="glass-enhanced rounded-2xl p-4 flex items-start gap-3 border border-amber-400/40 bg-amber-50/60 dark:bg-amber-900/20">
          <AlertTriangleIcon size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Payments are not configured. Set{' '}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
              VITE_DODO_PAYMENTS_ENABLED=true
            </code>{' '}
            in your <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">.env</code> file to enable purchases.
          </p>
        </div>
      )}

      {/* Credit pack cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {state.packsLoading ? (
          // Exactly 3 loading skeleton cards
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="glass-enhanced rounded-2xl p-6 animate-pulse"
              aria-hidden="true"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 mb-4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-full" />
            </div>
          ))
        ) : state.packs.length === 0 ? (
          <div className="col-span-3 glass-enhanced rounded-2xl p-12 text-center">
            <CreditCardIcon size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No credit packs available. Please check back later.
            </p>
          </div>
        ) : (
          state.packs.map((pack) => {
            const isThisPurchasing = isPurchasing && state.purchasingId === pack.product_id

            return (
              <div
                key={pack.product_id}
                className={`glass-enhanced rounded-2xl p-6 relative ${
                  pack.is_popular ? 'ring-2 ring-[#3FE0A5]' : ''
                }`}
              >
                {pack.is_popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#3FE0A5] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Most Popular
                  </span>
                )}

                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3FE0A5] to-[#38B897] flex items-center justify-center text-white mb-4">
                  <CreditCardIcon size={20} />
                </div>

                <h3 className="font-bold text-gray-900 dark:text-white mb-1">{pack.label}</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                  {pack.price_display}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {pack.credits} credits
                </p>

                <button
                  onClick={() => { void handlePurchase(pack) }}
                  disabled={buttonsDisabled}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity flex items-center justify-center gap-2 ${
                    pack.is_popular
                      ? 'bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white hover:opacity-90'
                      : 'glass-light text-gray-700 dark:text-gray-300 hover:glass'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isThisPurchasing ? (
                    <>
                      <Loader2Icon size={14} className="animate-spin" />
                      Processing…
                    </>
                  ) : (
                    'Purchase'
                  )}
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Test top-up button (sandbox only) */}
      {IS_SANDBOX && (
        <div className="glass-enhanced rounded-2xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sandbox mode: add test credits without going through checkout.
          </p>
          <button
            onClick={() => { void handleTestTopup() }}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Test: Add 100 Credits
          </button>
        </div>
      )}

      {/* Payment info footer */}
      <div className="glass-enhanced rounded-2xl p-4 flex items-start gap-3">
        <CreditCardIcon size={18} className="text-[#3FE0A5] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Payments are processed securely via Dodo Payments. Credits are added to your account
          after payment confirmation.
        </p>
      </div>
    </div>
  )
}

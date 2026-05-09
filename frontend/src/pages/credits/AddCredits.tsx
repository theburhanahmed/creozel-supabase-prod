import React, { useEffect, useState } from 'react'
import { CreditCardIcon, ZapIcon, StarIcon, RocketIcon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { getWallet } from '../../services/creditsService'
import type { Wallet } from '../../types'

const PLANS = [
  { credits: 100,  price: '$5',  label: 'Starter Pack',  icon: <ZapIcon size={20} />,    color: 'from-blue-500 to-indigo-500',   popular: false },
  { credits: 500,  price: '$20', label: 'Creator Pack',  icon: <StarIcon size={20} />,   color: 'from-[#3FE0A5] to-[#38B897]',  popular: true  },
  { credits: 1500, price: '$50', label: 'Pro Pack',      icon: <RocketIcon size={20} />, color: 'from-purple-500 to-violet-500', popular: false },
]

export const AddCredits: React.FC = () => {
  const { user } = useAppContext()
  const [wallet, setWallet] = useState<Wallet | null>(null)

  useEffect(() => {
    if (user) void getWallet(user.id).then(setWallet)
  }, [user])

  const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="glass-enhanced rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Add Credits</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Current balance: <span className="font-semibold text-[#3FE0A5]">{wallet?.balance ?? 0} credits</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div key={plan.credits} className={`glass-enhanced rounded-2xl p-6 relative ${plan.popular ? 'ring-2 ring-[#3FE0A5]' : ''}`}>
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#3FE0A5] text-white text-xs font-bold px-3 py-1 rounded-full">
                Most Popular
              </span>
            )}
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center text-white mb-4`}>
              {plan.icon}
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">{plan.label}</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{plan.price}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{plan.credits} credits</p>
            <button
              onClick={() => {
                if (!stripeKey) {
                  alert('Stripe is not configured. Set VITE_STRIPE_PUBLIC_KEY in your .env file.')
                  return
                }
                // In production: redirect to Stripe Checkout via Edge Function
                alert(`Stripe checkout for ${plan.credits} credits (${plan.price}) — configure STRIPE_SECRET_KEY in .env to enable.`)
              }}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 ${
                plan.popular
                  ? 'bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white'
                  : 'glass-light text-gray-700 dark:text-gray-300 hover:glass'
              }`}
            >
              Purchase
            </button>
          </div>
        ))}
      </div>

      <div className="glass-enhanced rounded-2xl p-4 flex items-start gap-3">
        <CreditCardIcon size={18} className="text-[#3FE0A5] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Payments are processed securely via Stripe. Credits are added to your account instantly after payment.
          For India-based payments, Razorpay is also supported.
        </p>
      </div>
    </div>
  )
}

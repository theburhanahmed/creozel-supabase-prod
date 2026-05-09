import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CopyIcon, CheckIcon, DollarSignIcon, UsersIcon, TrendingUpIcon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { AffiliateEarning, ReferralEvent } from '../../types'

export const AffiliatePage: React.FC = () => {
  const { user } = useAppContext()
  const [referralCode, setReferralCode] = useState<string>('')
  const [earnings, setEarnings]         = useState<AffiliateEarning[]>([])
  const [referrals, setReferrals]       = useState<ReferralEvent[]>([])
  const [copied, setCopied]             = useState(false)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [profileRes, earningsRes, referralsRes] = await Promise.all([
        supabase.from('profiles').select('referral_code').eq('id', user.id).single(),
        supabase.from('affiliate_earnings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('referral_events').select('*').eq('referrer_user_id', user.id).order('clicked_at', { ascending: false }),
      ])
      setReferralCode((profileRes.data as { referral_code?: string } | null)?.referral_code ?? '')
      setEarnings((earningsRes.data ?? []) as AffiliateEarning[])
      setReferrals((referralsRes.data ?? []) as ReferralEvent[])
      setLoading(false)
    }
    void load()
  }, [user])

  const referralLink = `${window.location.origin}?ref=${referralCode}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0)
  const conversions   = referrals.filter((r) => r.converted_at).length

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="glass-enhanced rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Affiliate Program</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Earn rewards by referring new users to Creozel</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Clicks',   value: referrals.length, icon: <TrendingUpIcon size={18} />, color: 'text-blue-500' },
          { label: 'Conversions',    value: conversions,       icon: <UsersIcon size={18} />,      color: 'text-green-500' },
          { label: 'Total Earned',   value: `$${totalEarnings}`, icon: <DollarSignIcon size={18} />, color: 'text-[#3FE0A5]' },
        ].map((stat) => (
          <div key={stat.label} className="glass-enhanced rounded-2xl p-4 text-center">
            <div className={`flex justify-center mb-2 ${stat.color}`}>{stat.icon}</div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="glass-enhanced rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Your Referral Link</h2>
        <div className="flex gap-2">
          <input readOnly value={loading ? 'Loading…' : referralLink}
            className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300" />
          <button onClick={() => void handleCopy()} disabled={!referralCode}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Earnings */}
      <div className="glass-enhanced rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Earnings History</h2>
        {earnings.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No earnings yet. Share your referral link to get started!</p>
        ) : (
          <div className="space-y-3">
            {earnings.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 glass-light rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">${e.amount}</p>
                  <p className="text-xs text-gray-400">{e.period_start ? `${new Date(e.period_start).toLocaleDateString()} – ${new Date(e.period_end ?? '').toLocaleDateString()}` : new Date(e.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${e.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                  {e.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

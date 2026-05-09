import React, { useEffect, useState } from 'react'
import { BarChart2Icon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { getTransactions, getWallet } from '../../services/creditsService'
import type { CreditTransaction, Wallet } from '../../types'

export const UsageHistory: React.FC = () => {
  const { user } = useAppContext()
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void Promise.all([getTransactions(user.id), getWallet(user.id)]).then(([txs, w]) => {
      setTransactions(txs)
      setWallet(w)
      setLoading(false)
    })
  }, [user])

  const deductions = transactions.filter((t) => t.type === 'deduction')
  const totalUsed  = deductions.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="glass-enhanced rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Usage History</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Credits consumed by AI generation</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-enhanced rounded-2xl p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Balance</p>
          <p className="text-3xl font-bold text-[#3FE0A5]">{wallet?.balance ?? 0}</p>
        </div>
        <div className="glass-enhanced rounded-2xl p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Used</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalUsed}</p>
        </div>
      </div>

      <div className="glass-enhanced rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/30">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Generation History</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-[#3FE0A5]/30 border-t-[#3FE0A5] rounded-full animate-spin mx-auto" /></div>
        ) : deductions.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart2Icon size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No usage yet. Generate some content to see usage here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200/50 dark:divide-gray-700/30">
            {deductions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{tx.description ?? 'AI generation'}</p>
                  <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
                <span className="text-sm font-bold text-red-500 flex-shrink-0">{tx.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

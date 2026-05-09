import React, { useEffect, useState } from 'react'
import { ReceiptIcon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { getTransactions } from '../../services/creditsService'
import type { CreditTransaction } from '../../types'

const TYPE_STYLES: Record<string, string> = {
  purchase:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  deduction: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  refund:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  bonus:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

export const TransactionHistory: React.FC = () => {
  const { user } = useAppContext()
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) void getTransactions(user.id).then((t) => { setTransactions(t); setLoading(false) })
  }, [user])

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="glass-enhanced rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Transaction History</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">All credit movements on your account</p>
      </div>

      <div className="glass-enhanced rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-[#3FE0A5]/30 border-t-[#3FE0A5] rounded-full animate-spin mx-auto" /></div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <ReceiptIcon size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200/50 dark:divide-gray-700/30">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-4 p-4">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${TYPE_STYLES[tx.type] ?? ''}`}>
                  {tx.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{tx.description ?? 'Credit transaction'}</p>
                  <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

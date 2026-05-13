import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { Wallet, CreditTransaction, DodoProduct } from '../types'

export async function getWallet(userId: string): Promise<Wallet | null> {
  try {
    const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).is('team_id', null).maybeSingle()
    if (error) { reportError('creditsService.getWallet', error); return null }
    return data as Wallet | null
  } catch (error: unknown) {
    reportError('creditsService.getWallet', error)
    return null
  }
}

export async function getCreditPacks(): Promise<DodoProduct[]> {
  try {
    const { data, error } = await supabase
      .from('dodo_products')
      .select('*')
      .eq('is_active', true)
      .order('credits', { ascending: true })
    if (error) { reportError('creditsService.getCreditPacks', error); return [] }
    return ((data ?? []) as DodoProduct[]).filter(
      (p) => p.credits > 0 && p.product_id !== ''
    )
  } catch (error: unknown) {
    reportError('creditsService.getCreditPacks', error)
    return []
  }
}

export async function getTransactions(userId: string, limit = 50): Promise<CreditTransaction[]> {
  try {
    const { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', userId).is('team_id', null).maybeSingle()
    if (!wallet) return []
    const { data, error } = await supabase.from('credit_transactions').select('*').eq('wallet_id', (wallet as { id: string }).id).order('created_at', { ascending: false }).limit(limit)
    if (error) { reportError('creditsService.getTransactions', error); return [] }
    return (data ?? []) as CreditTransaction[]
  } catch (error: unknown) {
    reportError('creditsService.getTransactions', error)
    return []
  }
}

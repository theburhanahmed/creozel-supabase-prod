import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { Wallet, CreditTransaction, DodoProduct } from '../types'

/**
 * Fetch the wallet for the active scope.
 * - If `teamId` is provided, returns the team wallet (creating it if missing).
 * - Otherwise, returns the user's personal wallet (team_id IS NULL).
 */
export async function getWallet(userId: string, teamId?: string): Promise<Wallet | null> {
  try {
    // Team wallets are owned by the team owner (user_id = owner_id), so filtering by
    // the current user's id would miss them for non-owner members. RLS enforces the
    // membership check via is_team_member(team_id).
    let query = supabase.from('wallets').select('*')
    if (teamId) {
      query = query.eq('team_id', teamId)
    } else {
      query = query.eq('user_id', userId).is('team_id', null)
    }
    const { data, error } = await query.maybeSingle()
    if (error) { reportError('creditsService.getWallet', error, { userId, teamId }); return null }
    return data as Wallet | null
  } catch (error: unknown) {
    reportError('creditsService.getWallet', error, { userId, teamId })
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

export async function getTransactions(userId: string, limit = 50, teamId?: string): Promise<CreditTransaction[]> {
  try {
    const wallet = await getWallet(userId, teamId)
    if (!wallet) return []
    const { data, error } = await supabase.from('credit_transactions').select('*').eq('wallet_id', wallet.id).order('created_at', { ascending: false }).limit(limit)
    if (error) { reportError('creditsService.getTransactions', error, { walletId: wallet.id }); return [] }
    return (data ?? []) as CreditTransaction[]
  } catch (error: unknown) {
    reportError('creditsService.getTransactions', error, { userId, teamId })
    return []
  }
}

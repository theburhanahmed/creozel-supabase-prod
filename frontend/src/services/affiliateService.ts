import { supabase } from '../lib/supabase'
import { reportError } from '../utils/errorReporter'
import type { AffiliateEarning, ReferralEvent } from '../types'

export interface AffiliateData {
  referralCode: string
  earnings: AffiliateEarning[]
  referrals: ReferralEvent[]
}

/**
 * Generate a random 8-character alphanumeric referral code.
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/**
 * Fetch all affiliate data for the current user.
 * Generates a referral code if one doesn't exist yet.
 */
export async function getAffiliateData(userId: string): Promise<AffiliateData> {
  try {
    const [profileRes, earningsRes, referralsRes] = await Promise.all([
      supabase.from('profiles').select('referral_code').eq('id', userId).single(),
      supabase.from('affiliate_earnings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('referral_events').select('*').eq('referrer_user_id', userId).order('created_at', { ascending: false }),
    ])

    if (profileRes.error) {
      reportError('affiliateService.getAffiliateData', profileRes.error, { userId, query: 'profiles' })
    }
    if (earningsRes.error) {
      reportError('affiliateService.getAffiliateData', earningsRes.error, { userId, query: 'affiliate_earnings' })
    }
    if (referralsRes.error) {
      reportError('affiliateService.getAffiliateData', referralsRes.error, { userId, query: 'referral_events' })
    }

    let referralCode = (profileRes.data as { referral_code?: string } | null)?.referral_code ?? ''

    // Generate a referral code if the user doesn't have one
    if (!referralCode) {
      referralCode = generateReferralCode()
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ referral_code: referralCode })
        .eq('id', userId)

      if (updateError) {
        reportError('affiliateService.getAffiliateData.generateCode', updateError, { userId })
        referralCode = ''
      }
    }

    return {
      referralCode,
      earnings: (earningsRes.data ?? []) as AffiliateEarning[],
      referrals: (referralsRes.data ?? []) as ReferralEvent[],
    }
  } catch (error: unknown) {
    reportError('affiliateService.getAffiliateData', error, { userId })
    return { referralCode: '', earnings: [], referrals: [] }
  }
}

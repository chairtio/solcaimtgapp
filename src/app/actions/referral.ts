'use server'

import { getReferrerByReferee } from '@/lib/database-admin'

export async function getMyReferralPercentAction(telegramId?: string): Promise<{
  referred: boolean
  referralPercent: number
}> {
  const tid = String(telegramId || '').trim()
  if (!tid) return { referred: false, referralPercent: 0 }

  try {
    const ref = await getReferrerByReferee(tid)
    if (!ref) return { referred: false, referralPercent: 0 }
    const pct = Number(ref.commissionPercentage ?? 0)
    const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
    return { referred: true, referralPercent: clamped }
  } catch {
    return { referred: false, referralPercent: 0 }
  }
}


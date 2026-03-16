'use server'

import { unstable_cache } from 'next/cache'
import { getLeaderboard, getTotalClaimed, getUserTransactions } from '@/lib/database'

/** Exclude anonymous users with very high amounts (e.g. test/internal accounts) from leaderboard display */
export async function getLeaderboardAction(limit = 10) {
  const cached = unstable_cache(
    async () => {
      const entries = await getLeaderboard(limit + 5)
      const filtered = entries.filter(
        (e) => !(e.displayName === 'Anon' && e.totalSol >= 1000)
      )
      return filtered.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }))
    },
    ['stats-leaderboard', String(limit)],
    { revalidate: 120 }
  )
  return cached()
}

export async function getTotalClaimedAction() {
  const cached = unstable_cache(getTotalClaimed, ['stats-total-claimed'], {
    revalidate: 120,
  })
  return cached()
}

export async function getRecentClaimsAction(userId: string, limit = 10) {
  const txs = await getUserTransactions(userId, limit)
  return txs
    .filter((t) => t.status === 'confirmed' && t.type === 'claim_rent')
    .map((t) => ({
      signature: t.signature,
      sol_amount: Number(t.sol_amount),
      created_at: t.created_at,
    }))
}

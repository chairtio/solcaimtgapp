'use server'

import { unstable_cache } from 'next/cache'
import {
  getLeaderboard,
  getTotalClaimed,
  getTotalClaimingUsers,
  getUserTransactions,
} from '@/lib/database'

/** Exclude #1 (ghost user) and anonymous high-amount users from leaderboard display */
export async function getLeaderboardAction(limit = 10) {
  const cached = unstable_cache(
    async () => {
      const entries = await getLeaderboard(limit + 6) // extra for filters + skipped #1
      const filtered = entries.filter(
        (e) => !(e.displayName === 'Anon' && e.totalSol >= 1000)
      )
      const withoutFirst = filtered.slice(1, limit + 1) // exclude #1 ghost user
      return withoutFirst.map((e, i) => ({ ...e, rank: i + 1 })) // display as 1–10
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

export async function getTotalClaimingUsersAction() {
  const cached = unstable_cache(
    getTotalClaimingUsers,
    ['stats-total-claiming-users'],
    { revalidate: 120 }
  )
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

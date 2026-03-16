'use server'

import { getLeaderboard, getTotalClaimed, getUserTransactions } from '@/lib/database'

/** Exclude anonymous users with very high amounts (e.g. test/internal accounts) from leaderboard display */
export async function getLeaderboardAction(limit = 10) {
  const entries = await getLeaderboard(limit + 5) // Fetch extra to compensate for filtered entries
  const filtered = entries.filter(
    (e) => !(e.displayName === 'Anon' && e.totalSol >= 1000)
  )
  return filtered.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }))
}

export async function getTotalClaimedAction() {
  return getTotalClaimed()
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

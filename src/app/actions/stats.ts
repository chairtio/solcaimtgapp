'use server'

import { getLeaderboard, getTotalClaimed, getUserTransactions } from '@/lib/database'

export async function getLeaderboardAction(limit = 10) {
  return getLeaderboard(limit)
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

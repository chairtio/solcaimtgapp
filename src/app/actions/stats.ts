'use server'

import { unstable_cache } from 'next/cache'
import {
  getLeaderboard,
  getTotalClaimed,
  getTotalClaimingUsers,
  getRecentClaims,
  getUserStats,
  getReferralPayoutStats,
} from '@/lib/database-admin'
import { requireTelegramUser } from '@/lib/telegram-user'

/** Cached user stats (has claimed?) – used for balance display. Revalidates every 5 min since it only changes on claim. */
export async function getUserStatsAction(telegramInitData: string) {
  const { userId } = await requireTelegramUser(telegramInitData)
  const cached = unstable_cache(
    () => getUserStats(userId),
    ['user-stats', userId],
    { revalidate: 300 }
  )
  return cached()
}

/** Batched stats: one round-trip instead of four when loading the stats tab */
export async function getStatsPageDataAction() {
  const [totalClaimed, totalClaimingUsers, leaderboard] = await Promise.all([
    getTotalClaimedAction(),
    getTotalClaimingUsersAction(),
    getLeaderboardAction(10),
  ])
  return { totalClaimed, totalClaimingUsers, leaderboard }
}

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

/** Recent claims – cached 10s for fast repeat loads. Use getRecentClaimsFreshAction after claim. */
export async function getRecentClaimsAction(telegramInitData: string, limit = 10) {
  const { userId } = await requireTelegramUser(telegramInitData)
  const cached = unstable_cache(
    () => getRecentClaims(userId, limit),
    ['recent-claims', userId, String(limit)],
    { revalidate: 10 }
  )
  return cached()
}

/** Recent claims – no cache. Use after successful claim for immediate refresh. */
export async function getRecentClaimsFreshAction(telegramInitData: string, limit = 10) {
  const { userId } = await requireTelegramUser(telegramInitData)
  return getRecentClaims(userId, limit)
}

/** Referral payout stats for Invite tab – total earned, referral count, etc. */
export async function getReferralStatsAction(telegramId: string) {
  return getReferralPayoutStats(telegramId)
}

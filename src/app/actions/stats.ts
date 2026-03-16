'use server'

import { getLeaderboard, getTotalClaimed } from '@/lib/database'

export async function getLeaderboardAction(limit = 10) {
  return getLeaderboard(limit)
}

export async function getTotalClaimedAction() {
  return getTotalClaimed()
}

'use server'

import { getLeaderboard } from '@/lib/database'

export async function getLeaderboardAction(limit = 10) {
  return getLeaderboard(limit)
}

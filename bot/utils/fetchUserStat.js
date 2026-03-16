/**
 * Fetches user stats from Supabase (replaces Xano).
 */
import pTimeout from './pTimeout.js'
import { urlStats } from '../private/private.js'
import { getUserStatsByTelegramId } from '../lib/supabase-bot.js'

const TIMEOUT_MS = 20000

async function routeUserStats(url) {
  if (url.startsWith(`${urlStats}/`)) {
    const userId = url.slice(urlStats.length + 1).split('/')[0]
    const stats = await getUserStatsByTelegramId(userId)
    return {
      total_sol_claimed: stats.total_sol_claimed,
      total_accounts_closed: stats.total_accounts_closed,
      claimed: stats.total_sol_claimed,
      users: 1
    }
  }
  throw new Error(`Unknown fetchUserStat route: ${url}`)
}

export const getUserStats = async (userId) => {
  try {
    const statsDataUser = await pTimeout(
      routeUserStats(`${urlStats}/${userId}`),
      { milliseconds: TIMEOUT_MS }
    )
    return statsDataUser
  } catch (error) {
    console.error(`Error fetching user stats for ${userId}:`, error.message)
    throw error
  }
}

/**
 * Fetches total stats from Supabase (replaces Xano).
 */
import pTimeout from './pTimeout.js'
import { getTotalStats } from '../lib/supabase-bot.js'

const TIMEOUT_MS = 20000

export const fetchStats = async () => {
  try {
    const statsData = await pTimeout(getTotalStats(), { milliseconds: TIMEOUT_MS })
    return statsData
  } catch (error) {
    console.error('Error fetching stats:', error.message)
    throw error
  }
}

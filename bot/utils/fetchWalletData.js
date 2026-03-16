/**
 * Fetches wallet(s) from Supabase.
 */
import pTimeout from './pTimeout.js'
import { getWalletsByTelegramId, getWalletById } from '../lib/supabase-bot.js'

const TIMEOUT_MS = 70000

export const fetchWalletData = async (userId, walletId = null) => {
  try {
    if (walletId) {
      const wallet = await pTimeout(getWalletById(walletId), { milliseconds: TIMEOUT_MS })
      return wallet ? [wallet] : []
    }
    const wallets = await pTimeout(getWalletsByTelegramId(userId), { milliseconds: TIMEOUT_MS })
    return wallets || []
  } catch (error) {
    console.error('Error fetching wallet data:', error)
    throw error
  }
}

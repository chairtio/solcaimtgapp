/**
 * Gets user withdrawal (receiver) wallet from Supabase.
 */
import { PublicKey } from '@solana/web3.js'
import pTimeout from './pTimeout.js'
import { getUserByTelegramId } from '../lib/supabase-bot.js'

const TIMEOUT_MS = 20000

export const getUserWithdrawWallet = async (userId) => {
  try {
    const user = await pTimeout(getUserByTelegramId(userId), { milliseconds: TIMEOUT_MS })
    return user?.receiver_wallet?.trim()
      ? new PublicKey(user.receiver_wallet)
      : null
  } catch (error) {
    console.error('Error fetching user withdraw wallet:', error.message)
    return null
  }
}

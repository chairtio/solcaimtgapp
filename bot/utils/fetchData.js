/**
 * Routes Supabase URLs to supabase-bot; falls back to fetch for Xano (airdrop etc).
 */
import fetch from 'node-fetch'
import pTimeout from './pTimeout.js'
import { authToken } from '../private/private.js'
import {
  getUserByTelegramId,
  createUser,
  updateUserByTelegramId,
  getWalletsByTelegramId,
  insertWallets,
  getWalletById,
  deleteWallet,
  deleteAllWalletsByTelegramId,
  getTotalStats,
  getLeaderboard,
  getReferralLeaderboard,
  getRefPayoutStats,
  createReferralRecord,
} from '../lib/supabase-bot.js'

const TIMEOUT_MS = 20000

export const fetchData = async (url, method = 'GET', body = null) => {
  try {
    // Route Supabase URLs
    if (url.startsWith('supabase:')) {
      const data = await pTimeout(routeSupabase(url, method, body), { milliseconds: TIMEOUT_MS })
      return data
    }

    // Xano fallback (airdrop, etc)
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (authToken) options.headers['Authorization'] = `Bearer ${authToken}`
    if (body) options.body = JSON.stringify(body)

    const fetchPromise = fetch(url, options).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch data: ${r.status} - ${r.statusText}`)
      return r.json()
    })
    return await pTimeout(fetchPromise, { milliseconds: TIMEOUT_MS })
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error.message)
    throw error
  }
}

async function routeSupabase(url, method, body) {
  // --- Mutations first (avoid being caught by GET matchers) ---

  // PUT supabase:wallets_delete (delete all wallets for user)
  if (method === 'PUT' && url === 'supabase:wallets_delete') {
    const payload = body || {}
    const telegramId = payload.telegram_id
    if (!telegramId) throw new Error('Missing telegram_id')
    await deleteAllWalletsByTelegramId(telegramId)
    return { success: true }
  }

  // PUT supabase:wallet/:id/delete
  if (method === 'PUT' && url.startsWith('supabase:wallet/') && url.includes('/delete')) {
    const walletId = url.replace('supabase:wallet/', '').replace('/delete', '')
    await deleteWallet(walletId)
    return { success: true }
  }

  // PATCH supabase:telegram_user/123
  if (method === 'PATCH' && url.startsWith('supabase:telegram_user/')) {
    const userId = url.replace('supabase:telegram_user/', '')
    const payload = body || {}
    return await updateUserByTelegramId(userId, {
      username: payload.username,
      withdrawal_wallet: payload.withdrawal_wallet,
    })
  }

  // GET supabase:telegram_user/123
  if (method === 'GET' && url.startsWith('supabase:telegram_user/')) {
    const userId = url.replace('supabase:telegram_user/', '')
    const user = await getUserByTelegramId(userId)
    if (!user) throw new Error('User not found')
    return { ...user, withdrawal_wallet: user.receiver_wallet }
  }

  // POST supabase:telegram_user
  if (method === 'POST' && url === 'supabase:telegram_user') {
    const payload = body || {}
    return await createUser({
      telegram_id: payload.telegram_id,
      username: payload.username,
      first_name: payload.first_name,
      last_name: payload.last_name,
    })
  }

  // GET supabase:wallets?telegram_id=123
  if (method === 'GET' && (url === 'supabase:wallets' || url.startsWith('supabase:wallets?'))) {
    const match = url.match(/telegram_id=(\d+)/)
    const userId = match ? match[1] : null
    if (!userId) return []
    return await getWalletsByTelegramId(userId)
  }

  // POST supabase:wallets
  if (method === 'POST' && url === 'supabase:wallets') {
    const payload = body || {}
    const telegramId = payload.telegram_user_id
    const wallets = payload.wallets || []
    if (!telegramId || !wallets.length) throw new Error('Missing telegram_user_id or wallets')
    return await insertWallets(telegramId, wallets)
  }

  // GET supabase:wallet/:id
  if (method === 'GET' && url.startsWith('supabase:wallet/')) {
    const rest = url.replace('supabase:wallet/', '')
    const walletId = rest.includes('/delete') ? rest.replace('/delete', '') : rest
    const wallet = await getWalletById(walletId)
    if (!wallet) throw new Error('Wallet not found')
    return wallet
  }

  // GET supabase:stats or supabase:total_stats
  if (url === 'supabase:stats' || url === 'supabase:total_stats') {
    const stats = await getTotalStats()
    return { claimed: stats.claimed, users: stats.users }
  }

  // GET supabase:leaderboard
  if (url === 'supabase:leaderboard') {
    return await getLeaderboard()
  }

  // GET supabase:leaderboard_ref
  if (url === 'supabase:leaderboard_ref') {
    return await getReferralLeaderboard()
  }

  // GET supabase:ref_payout/123
  if (url.startsWith('supabase:ref_payout/')) {
    const userId = url.replace('supabase:ref_payout/', '')
    return await getRefPayoutStats(userId)
  }

  // POST supabase:referral
  if (method === 'POST' && url === 'supabase:referral') {
    const payload = body || {}
    return await createReferralRecord(
      payload.referrer_telegram_id,
      payload.referred_telegram_id,
      payload.referral_code
    )
  }

  // PUT supabase:user_trading_bot/123 (stub - optional trading bot flag)
  if (method === 'PUT' && url.startsWith('supabase:user_trading_bot/')) {
    return { ok: true }
  }

  throw new Error(`Unknown Supabase route: ${url} ${method}`)
}

/**
 * Supabase adapter - replaces all Xano API calls.
 * Same interface/shapes expected by the bot.
 */
import { createClient } from '@supabase/supabase-js'
import { PublicKey } from '@solana/web3.js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.warn('Supabase env not set - bot will fail without NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = url && key
  ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

/** Get Supabase client for custom queries (e.g. follow-up scheduler) */
export function getSupabase() {
  return supabase
}

// --- User ---

/** Get user by telegram_id. Returns null if not found. */
export async function getUserByTelegramId(telegramId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', String(telegramId))
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

/** Create user. Xano shape: { telegram_id, username } */
export async function createUser(userData) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('users')
    .insert({
      telegram_id: String(userData.telegram_id),
      username: userData.username || null,
      first_name: userData.first_name || 'User',
      last_name: userData.last_name || null
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Mark user as having blocked the bot. Called when sendMessage returns 403. */
export async function markUserBotBlocked(telegramId) {
  if (!supabase) return
  const { error } = await supabase
    .from('users')
    .update({ bot_blocked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('telegram_id', String(telegramId))
  if (error) console.error('[supabase-bot] markUserBotBlocked:', error.message)
}

/** Update user (e.g. withdrawal_wallet -> receiver_wallet) */
export async function updateUserByTelegramId(telegramId, updates) {
  if (!supabase) throw new Error('Supabase not configured')
  const payload = { updated_at: new Date().toISOString() }
  if (updates.withdrawal_wallet != null) payload.receiver_wallet = updates.withdrawal_wallet
  if (updates.username != null) payload.username = updates.username
  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('telegram_id', String(telegramId))
    .select()
    .single()
  if (error) throw error
  return data
}

// --- Wallets (Xano shape: { id, public_key, private_key } for each) ---

/** Get wallets for telegram_id. Returns [{ id, public_key, private_key }]. */
export async function getWalletsByTelegramId(telegramId) {
  if (!supabase) return []
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', String(telegramId))
    .single()
  if (!user) return []
  const { data: wallets, error } = await supabase
    .from('wallets')
    .select('id, public_key, encrypted_private_key')
    .eq('user_id', user.id)
    .eq('status', 'active')
  if (error) throw error
  return (wallets || []).map(w => ({
    id: w.id,
    public_key: w.public_key,
    private_key: w.encrypted_private_key || ''
  }))
}

/** Get single wallet by id (for bot internal use) */
export async function getWalletById(walletId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('wallets')
    .select('id, public_key, encrypted_private_key, user_id')
    .eq('id', walletId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null
  return {
    id: data.id,
    public_key: data.public_key,
    private_key: data.encrypted_private_key || ''
  }
}

/** Insert wallets. Xano: { wallets: [{ public_key, private_key }], telegram_user_id } */
export async function insertWallets(telegramId, wallets) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', String(telegramId))
    .single()
  if (!user) throw new Error('User not found')
  const rows = wallets.map(w => ({
    user_id: user.id,
    public_key: w.public_key,
    encrypted_private_key: w.private_key || w.encrypted_private_key,
    status: 'active'
  }))
  const { data, error } = await supabase
    .from('wallets')
    .insert(rows)
    .select()
  if (error) throw error
  return data
}

/** Delete wallet by id */
export async function deleteWallet(walletId) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('wallets')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', walletId)
  if (error) throw error
}

/** Delete all wallets for telegram_id */
export async function deleteAllWalletsByTelegramId(telegramId) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', String(telegramId))
    .single()
  if (!user) return
  const { error } = await supabase
    .from('wallets')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
  if (error) throw error
}

// --- Claims / Transactions ---

/** Create transaction (urlClaim POST). Xano: { telegram_user_id, wallet_id, fee, tx_id, amount, payout_amount } */
export async function createClaim(telegramUserId, walletId, fee, txId, amount, payoutAmount) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', String(telegramUserId))
    .single()
  if (!user) throw new Error('User not found')
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id')
    .eq('user_id', user.id)
    .eq('public_key', walletId)
    .single()
  if (!wallet) throw new Error('Wallet not found')
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      wallet_id: wallet.id,
      signature: txId,
      type: 'batch_claim',
      status: 'confirmed',
      sol_amount: payoutAmount,
      accounts_closed: 1,
      fee_amount: fee
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Create transaction with proper wallet_id lookup by telegram wallet id (Xano wallet id) */
export async function createTransactionRecord(telegramUserId, xanoWalletId, fee, txId, amount, payoutAmount, accountsClosed = 1) {
  if (!supabase) throw new Error('Supabase not configured')
  // Xano wallet_id may be their id - we use our wallet uuid. Bot passes wallet id from fetchWalletData.
  const walletId = xanoWalletId
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      wallet_id: walletId,
      signature: txId,
      type: 'batch_claim',
      status: 'confirmed',
      sol_amount: payoutAmount,
      accounts_closed: accountsClosed,
      fee_amount: fee
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// --- Stats ---

/** Record first-touch ad campaign attribution (e.g. /start camp_xxx). No-op if unknown code or already attributed. */
export async function recordAdAttribution(telegramId, sourceCode) {
  if (!supabase || !sourceCode || typeof sourceCode !== 'string') return
  const code = sourceCode.trim()
  if (code.length > 64 || !/^camp_[a-zA-Z0-9_-]+$/.test(code)) return
  const { data: user } = await supabase.from('users').select('id').eq('telegram_id', String(telegramId)).single()
  if (!user?.id) return
  const { data: campaign } = await supabase.from('ad_campaigns').select('id').eq('source_code', code).single()
  if (!campaign?.id) return
  await supabase
    .from('ad_campaign_attribution')
    .upsert(
      { user_id: user.id, ad_campaign_id: campaign.id },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )
}

/** Get total claimed and total users. Xano urlTotalStats shape: { claimed, users } */
export async function getTotalStats() {
  if (!supabase) return { claimed: 0, users: 0 }
  const { data: claimedData } = await supabase.rpc('get_total_claimed')
  const { data: usersData } = await supabase.rpc('get_total_claiming_users')
  const row = Array.isArray(claimedData) && claimedData[0] ? claimedData[0] : null
  const totalSol = row ? parseFloat(row.total_sol || 0) : 0
  const users = typeof usersData === 'number' ? usersData : parseInt(usersData || 0, 10)
  return { claimed: totalSol, users }
}

/** Get user stats by telegram_id. Returns { total_sol_claimed, total_accounts_closed } */
export async function getUserStatsByTelegramId(telegramId) {
  if (!supabase) return { total_sol_claimed: 0, total_accounts_closed: 0 }
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', String(telegramId))
    .single()
  if (!user) return { total_sol_claimed: 0, total_accounts_closed: 0 }
  const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: user.id })
  if (error) throw error
  const row = Array.isArray(data) && data[0] ? data[0] : null
  return {
    total_sol_claimed: row ? parseFloat(row.total_sol_claimed || 0) : 0,
    total_accounts_closed: row ? parseInt(row.total_accounts_closed || 0, 10) : 0
  }
}

// --- Referrals ---

/** Create referral. Xano: { referrer_telegram_id, referred_telegram_id } */
export async function createReferralRecord(referrerTelegramId, referredTelegramId, referralCode) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: referrer } = await supabase.from('users').select('id').eq('telegram_id', String(referrerTelegramId)).single()
  const { data: referee } = await supabase.from('users').select('id').eq('telegram_id', String(referredTelegramId)).single()
  if (!referrer || !referee) throw new Error('User not found')
  const code = referralCode || `ref_${referrer.id.slice(0, 8)}_${Date.now()}`
  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referrer_id: referrer.id,
      referee_id: referee.id,
      referral_code: code,
      status: 'completed',
      commission_percentage: 10
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Get referrer by referee telegram_id. Xano urlReferralBy shape: { telegram_id, commission_percentage } */
export async function getReferrerByRefereeTelegramId(refereeTelegramId) {
  if (!supabase) return null
  const { data: referee } = await supabase.from('users').select('id').eq('telegram_id', String(refereeTelegramId)).single()
  if (!referee) return null
  const { data: ref } = await supabase
    .from('referrals')
    .select('referrer_id, commission_percentage')
    .eq('referee_id', referee.id)
    .limit(1)
    .single()
  if (!ref) return null
  const { data: referrer } = await supabase
    .from('users')
    .select('telegram_id, receiver_wallet, referrer_commission_percent')
    .eq('id', ref.referrer_id)
    .single()
  if (!referrer?.receiver_wallet?.trim()) return null
  const effectiveCommission = referrer.referrer_commission_percent ?? ref.commission_percentage ?? 10
  return {
    telegram_id: referrer.telegram_id,
    commission_percentage: effectiveCommission
  }
}

/** Create referral payout. Xano: { telegram_user_id, amount, claim_id } */
export async function createReferralPayoutRecord(referrerTelegramId, amount, claimId) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: referrer } = await supabase.from('users').select('id').eq('telegram_id', String(referrerTelegramId)).single()
  if (!referrer) throw new Error('Referrer not found')
  const { data, error } = await supabase
    .from('referral_payouts')
    .insert({
      referrer_id: referrer.id,
      amount,
      transaction_id: claimId
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// --- Leaderboards ---

/** Get claims leaderboard. Xano shape: [{ rank, user_id, total_claim_amount, display_name?, telegram_id? }] */
export async function getLeaderboard(limit = 20) {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: limit })
  if (error) throw error
  if (!Array.isArray(data)) return []
  const { data: users } = await supabase.from('users').select('id, telegram_id, first_name, username')
  const userMap = new Map((users || []).map(u => [u.id, u]))
  return data.map((row, i) => ({
    rank: i + 1,
    user_id: row.user_id,
    total_claim_amount: parseFloat(row.total_sol || 0),
    display_name: row.display_name || 'Anon',
    telegram_id: userMap.get(row.user_id)?.telegram_id || 0
  }))
}

/** Get referral leaderboard. Xano shape: [{ telegram_id, num_referred_users, total_ref_payout_amount }] */
export async function getReferralLeaderboard(limit = 10) {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('get_referral_leaderboard', { p_limit: limit })
  if (error) throw error
  if (!Array.isArray(data)) return []
  return data.map(row => ({
    telegram_id: row.telegram_id,
    num_referred_users: parseInt(row.num_referred_users || 0, 10),
    total_ref_payout_amount: parseFloat(row.total_ref_payout_amount || 0)
  }))
}

/** Get ref payout stats for telegram_id. urlRefPayout shape */
export async function getRefPayoutStats(telegramId) {
  if (!supabase) return { total_ref_payout_amount: 0, total_referred_users: 0, num_referred_users_made_claims: 0, commission_percentage: 10 }
  const { data, error } = await supabase.rpc('get_ref_payout_stats', { p_telegram_id: String(telegramId) })
  if (error) throw error
  const row = Array.isArray(data) && data[0] ? data[0] : null
  return {
    total_ref_payout_amount: row ? parseFloat(row.total_ref_payout_amount || 0) : 0,
    total_referred_users: row ? parseInt(row.total_referred_users || 0, 10) : 0,
    num_referred_users_made_claims: row ? parseInt(row.num_referred_users_made_claims || 0, 10) : 0,
    commission_percentage: row ? parseInt(row.commission_percentage || 10, 10) : 10
  }
}

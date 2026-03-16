/**
 * Bot private - re-exports from lib/config.js + URL constants for routing.
 * Utils (fetchData, postToApi, etc.) route these URLs to Supabase adapters.
 */
export {
  redis,
  apiKeyCoinMarketCap,
  exchangesList,
  connection,
  apiKeyHeliusExport as apiKeyHelius,
  urlTokenData,
  apiTelegramExport as apiTelegram,
  bot,
  groupChatId,
  claimTopics,
  AirdropTopics,
  TIMEOUT_MS,
  feePayerWallet,
  commissionAddress,
  baseCommissionRate,
  transactionPriorityFee,
  totalAmountClaim,
  SOL_CLAIM_PER_TOKEN_ACCOUNT,
} from '../lib/config.js'

// URL constants - used as routing keys by fetchData/postToApi (no longer Xano)
export const urlTelegramUser = 'supabase:telegram_user'
export const urlTelegramWallets = 'supabase:wallets'
export const urlTelegramWallet = 'supabase:wallet'
export const urlDeleteAllWallets = 'supabase:wallets_delete'
export const urlClaim = 'supabase:claim'
export const urlStats = 'supabase:stats'
export const urlReferral = 'supabase:referral'
export const urlReferralBy = 'supabase:referred_by'
export const urlReferralPayout = 'supabase:referral_payout'
export const urlLeaderboard = 'supabase:leaderboard'
export const urlTotalStats = 'supabase:total_stats'
export const urlLeaderboardRef = 'supabase:leaderboard_ref'
export const urlRefPayout = 'supabase:ref_payout'
export const urlUserTradingBot = 'supabase:user_trading_bot'

// For Xano fallback (airdrop, etc) - optional
export const authToken = process.env.AUTH_TOKEN || null

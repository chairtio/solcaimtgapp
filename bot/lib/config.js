/**
 * Bot config - replaces private/private.js. Uses env vars, unified with mini app config.
 */
import dotenv from 'dotenv'
// Load .env.local first (common for secrets), then .env
dotenv.config({ path: '.env.local' })
dotenv.config()
import bs58 from 'bs58'
import { Keypair, Connection, PublicKey } from '@solana/web3.js'
import Redis from 'ioredis'
import { Telegraf } from 'telegraf'

// Redis - REDIS_URL or fallback to localhost
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
export const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 })

// CoinMarketCap / exchanges (unchanged from original)
export const apiKeyCoinMarketCap = 'ab15f09c-4b98-4793-8cb4-bae3971da77c'
export const exchangesList = ['okx', 'huobi', 'gate', 'kucoin', 'bitget', 'mexc']

// Solana - use NEXT_PUBLIC_SOLANA_RPC_URL everywhere
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const apiKeyHelius = (() => {
  const match = rpcUrl.match(/api-key=([^&]+)/)
  return match ? match[1] : (process.env.API_HELIUS || process.env.HELIUS_API_KEY || null)
})()
export const connection = new Connection(rpcUrl, 'confirmed')
export const apiKeyHeliusExport = apiKeyHelius
export const urlTokenData = apiKeyHelius ? `https://api.helius.xyz/v0/token-metadata?api-key=${apiKeyHelius}` : null

// Telegram bot
const apiTelegram = process.env.TELEGRAM_BOT_TOKEN || process.env.API_TELEGRAM
if (!apiTelegram) {
  console.warn('TELEGRAM_BOT_TOKEN not set - bot will fail to start')
}
export const apiTelegramExport = apiTelegram
export const bot = new Telegraf(apiTelegram || 'placeholder', { telegram: { webhookReply: true, testEnv: false } })

// Group / topics
export const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID || '-1001265590297'
export const claimTopics = parseInt(process.env.TELEGRAM_CLAIM_TOPICS_ID || '247118', 10)
export const AirdropTopics = parseInt(process.env.TELEGRAM_AIRDROP_TOPICS_ID || '142362', 10)
export const TIMEOUT_MS = 80000

// Fee payer - FEE_PAYER_PRIVATE_KEY or FEEPAYER
const feePayerKey = process.env.FEE_PAYER_PRIVATE_KEY || process.env.FEEPAYER
export const feePayerWallet = feePayerKey
  ? Keypair.fromSecretKey(bs58.decode(feePayerKey.trim()))
  : null

// Commission
const commissionAddr = process.env.COMMISSION_WALLET
export const commissionAddress = commissionAddr ? new PublicKey(commissionAddr) : null

// Fee/claim amounts - from env, match mini app config
const parseNum = (v, d) => (v === undefined || v === '' ? d : (parseFloat(v) || d))
const parseIntSafe = (v, d) => (v === undefined || v === '' ? d : (parseInt(v, 10) || d))

// Platform commission percent (0-100). 0 = user gets 100%.
export const SOLCLAIM_COMMISSION_PERCENT = parseNum(process.env.SOLCLAIM_COMMISSION_PERCENT, 0)

// Referral percent (0-100). Only applied when the user was referred.
export const SOLCLAIM_REFERRAL_PERCENT = parseIntSafe(process.env.SOLCLAIM_REFERRAL_PERCENT, 10)

export const baseCommissionRate =
  SOLCLAIM_COMMISSION_PERCENT > 0
    ? totalAmountClaim * (SOLCLAIM_COMMISSION_PERCENT / 100)
    : parseNum(process.env.SOLCLAIM_COMMISSION_PER_ACCOUNT, 0.00053928)
export const transactionPriorityFee = parseNum(process.env.TRANSACTION_PRIORITY_FEE, 0.00004)
export const totalAmountClaim = parseNum(process.env.SOLCLAIM_RENT_PER_ACCOUNT, 0.00203928)
export const SOL_CLAIM_PER_TOKEN_ACCOUNT = parseNum(process.env.SOLCLAIM_USER_PAYOUT_PER_ACCOUNT, 0.0015)

// Derived: user payout per account before referral split, matching src/lib/config.ts
export const userPayoutBeforeReferralPerAccount =
  SOLCLAIM_COMMISSION_PERCENT > 0
    ? totalAmountClaim - (totalAmountClaim * (SOLCLAIM_COMMISSION_PERCENT / 100))
    : totalAmountClaim

export function computeNetPayoutPerAccount(referralPercent) {
  const pct = typeof referralPercent === 'number' && Number.isFinite(referralPercent) ? referralPercent : 0
  const clamped = Math.max(0, Math.min(100, pct))
  return userPayoutBeforeReferralPerAccount * (1 - clamped / 100)
}

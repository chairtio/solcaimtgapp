/**
 * Unified fee and settings configuration.
 * Single source of truth for mini app and bot - all values from env.
 */

import { PublicKey } from '@solana/web3.js'

const parseNum = (val: string | undefined, defaultVal: number): number => {
  if (val === undefined || val === '') return defaultVal
  const n = parseFloat(val)
  return Number.isFinite(n) ? n : defaultVal
}

const parseIntSafe = (val: string | undefined, defaultVal: number): number => {
  if (val === undefined || val === '') return defaultVal
  const n = parseInt(val, 10)
  return Number.isFinite(n) ? n : defaultVal
}

/** Platform commission percent (0–100). 0 = user gets 100%. */
export const SOLCLAIM_COMMISSION_PERCENT = parseNum(
  process.env.SOLCLAIM_COMMISSION_PERCENT,
  0
)

/** Referral program: % of referred user's claim that goes to referrer. Default 10. */
export const SOLCLAIM_REFERRAL_PERCENT = parseIntSafe(
  process.env.SOLCLAIM_REFERRAL_PERCENT,
  10
)

/** Total rent per empty token account (SOL). */
export const SOLCLAIM_RENT_PER_ACCOUNT = parseNum(
  process.env.SOLCLAIM_RENT_PER_ACCOUNT,
  0.00203928
)

/** User payout per account when commission=0, or base user amount. */
export const SOLCLAIM_USER_PAYOUT_PER_ACCOUNT = parseNum(
  process.env.SOLCLAIM_USER_PAYOUT_PER_ACCOUNT,
  0.0015
)

/** True when platform takes commission (needs COMMISSION_WALLET). */
export const hasPlatformCommission = SOLCLAIM_COMMISSION_PERCENT > 0

/**
 * Platform commission amount per account (SOL).
 * When commission > 0: rent * (commissionPercent/100).
 * When commission = 0: 0.
 */
export const SOLCLAIM_COMMISSION_PER_ACCOUNT = hasPlatformCommission
  ? SOLCLAIM_RENT_PER_ACCOUNT * (SOLCLAIM_COMMISSION_PERCENT / 100)
  : 0

/**
 * User payout per account before referral (SOL).
 * When commission = 0: full rent.
 * When commission > 0: rent - commission.
 */
export const SOLCLAIM_USER_PAYOUT_BEFORE_REFERRAL = hasPlatformCommission
  ? SOLCLAIM_RENT_PER_ACCOUNT - SOLCLAIM_COMMISSION_PER_ACCOUNT
  : SOLCLAIM_RENT_PER_ACCOUNT

/** Commission wallet address (required when SOLCLAIM_COMMISSION_PERCENT > 0). */
export function getCommissionWallet(): PublicKey | null {
  const addr = process.env.COMMISSION_WALLET?.trim()
  if (!addr) return null
  try {
    return new PublicKey(addr)
  } catch {
    return null
  }
}

/** True when referral program is active (referrer gets % of user claim). */
export const hasReferralProgram = SOLCLAIM_REFERRAL_PERCENT > 0

/** Fee payer private key (base58). Pays gas so users can claim with 0 SOL. */
export const FEE_PAYER_PRIVATE_KEY = process.env.FEE_PAYER_PRIVATE_KEY?.trim() ?? ''

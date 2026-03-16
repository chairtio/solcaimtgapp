/**
 * Routes claim/referral-payout to Supabase; no longer POSTs to Xano.
 */
import pTimeout from './pTimeout.js'
import { urlClaim, urlReferralPayout } from '../private/private.js'
import {
  createTransactionRecord,
  createReferralPayoutRecord,
} from '../lib/supabase-bot.js'

const TIMEOUT_MS = 40000

export async function postToApi(url, postData) {
  try {
    if (url === urlClaim) {
      const { telegram_user_id, wallet_id, fee, tx_id, amount, payout_amount } = postData
      const accountsClosed = postData.accounts_closed ?? 1
      const data = await pTimeout(
        createTransactionRecord(
          telegram_user_id,
          wallet_id,
          fee,
          tx_id,
          amount,
          payout_amount,
          accountsClosed
        ),
        { milliseconds: TIMEOUT_MS }
      )
      return data
    }

    if (url === urlReferralPayout) {
      const { telegram_user_id, amount, claim_id } = postData
      const data = await pTimeout(
        createReferralPayoutRecord(telegram_user_id, amount, claim_id),
        { milliseconds: TIMEOUT_MS }
      )
      return data
    }

    throw new Error(`postToApi: unknown url ${url}`)
  } catch (error) {
    if (error.name === 'TimeoutError') {
      console.error(`Request timed out after ${TIMEOUT_MS} ms`)
    } else {
      console.error(`Failed to post ${url}:`, error.message)
    }
    throw error
  }
}

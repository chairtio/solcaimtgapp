/**
 * Routes Supabase referral URLs to supabase-bot; falls back to fetch for Xano.
 */
import fetch from 'node-fetch'
import pTimeout from './pTimeout.js'
import { authToken } from '../private/private.js'
import { getReferrerByRefereeTelegramId, getRefPayoutStats } from '../lib/supabase-bot.js'

const TIMEOUT_MS = 20000

export const fetchDataReferral = async (url, method = 'GET', body = null, suppressErrors = false) => {
  try {
    if (url.startsWith('supabase:referred_by/')) {
      const userId = url.replace('supabase:referred_by/', '')
      const data = await pTimeout(getReferrerByRefereeTelegramId(userId), { milliseconds: TIMEOUT_MS })
      return data
    }

    if (url.startsWith('supabase:ref_payout/')) {
      const userId = url.replace('supabase:ref_payout/', '')
      const data = await pTimeout(getRefPayoutStats(userId), { milliseconds: TIMEOUT_MS })
      return data
    }

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
    if (!suppressErrors) {
      console.error(`Error fetching data Referral from ${url}:`, error.message)
    }
    throw error
  }
}

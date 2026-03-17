/**
 * Validate Telegram WebApp initData server-side.
 * Per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import crypto from 'crypto'

const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface ValidatedUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface ValidatedInitData {
  user: ValidatedUser
  auth_date: number
}

/**
 * Validate initData from Telegram WebApp.
 * Returns parsed data if valid, null otherwise.
 */
export function validateInitData(initData: string): ValidatedInitData | null {
  if (!initData || typeof initData !== 'string') return null

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null

  try {
    const encoded = decodeURIComponent(initData)
    const arr = encoded.split('&')
    const hashIdx = arr.findIndex((s) => s.startsWith('hash='))
    if (hashIdx === -1) return null

    const hash = arr.splice(hashIdx)[0]?.split('=')[1]
    if (!hash) return null

    arr.sort((a, b) => a.localeCompare(b))
    const dataCheckString = arr.join('\n')

    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(token)
      .digest()

    const computed = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex')

    if (computed !== hash) return null

    const authDateStr = arr.find((s) => s.startsWith('auth_date='))?.split('=')[1]
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0
    if (!authDate || Number.isNaN(authDate)) return null

    const age = Date.now() - authDate * 1000
    if (age > MAX_AGE_MS || age < -60000) return null

    const userStr = arr.find((s) => s.startsWith('user='))?.split('=').slice(1).join('=')
    if (!userStr) return null

    const user = JSON.parse(decodeURIComponent(userStr)) as ValidatedUser
    if (!user?.id) return null

    return { user, auth_date: authDate }
  } catch {
    return null
  }
}

/**
 * Extract initData from request headers.
 * Accepts X-Telegram-Init-Data or Authorization: Bearer <initData>
 */
export function getInitDataFromRequest(request: Request): string | null {
  const fromHeader = request.headers.get('X-Telegram-Init-Data')
  if (fromHeader) return fromHeader

  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)

  return null
}

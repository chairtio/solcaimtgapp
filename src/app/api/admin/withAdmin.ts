/**
 * Admin API helper: validates initData and admin status.
 * Returns { telegramId } or NextResponse with 403.
 */

import { NextResponse } from 'next/server'
import { validateInitData, getInitDataFromRequest } from '@/lib/telegram-auth'
import { isAdmin } from '@/lib/database'

export async function requireAdmin(request: Request): Promise<
  | { telegramId: string; ok: true }
  | { ok: false; response: NextResponse }
> {
  const initData = getInitDataFromRequest(request)
  if (!initData) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Missing init data' }, { status: 401 }),
    }
  }

  const validated = validateInitData(initData)
  if (!validated) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid init data' }, { status: 403 }),
    }
  }

  const telegramId = validated.user.id.toString()
  const admin = await isAdmin(telegramId)
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Not authorized' }, { status: 403 }),
    }
  }

  return { telegramId, ok: true }
}

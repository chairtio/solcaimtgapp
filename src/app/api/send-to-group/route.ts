import { NextRequest, NextResponse } from 'next/server'
import { getInitDataFromRequest, validateInitData } from '@/lib/telegram-auth'

const TELEGRAM_API = 'https://api.telegram.org'
const TIMEOUT_MS = 15000

function abbreviateUserId(id: string | number): string {
  const str = String(id)
  if (str.length <= 6) return str
  return `${str.slice(0, 3)}...${str.slice(-3)}`
}

/**
 * POST /api/send-to-group
 * Body: { id, created_at, airdrop_id, telegram_user_id, amount, processed, _telegram_user: { username?, telegram_id }, diamonds }
 * Forwards airdrop request message to Telegram group (AirdropTopics thread)
 */
export async function POST(req: NextRequest) {
  // Require either a valid Telegram initData (user-originated) OR an internal secret (service-to-service).
  const internalSecret = process.env.INTERNAL_API_SECRET?.trim()
  const providedInternalSecret = req.headers.get('X-Internal-Api-Secret')?.trim()
  const initData = getInitDataFromRequest(req)
  const validInitData = initData ? validateInitData(initData) : null
  const internalAuthed = !!internalSecret && providedInternalSecret === internalSecret
  if (!validInitData && !internalAuthed) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID || '-1001265590297'
  const airdropTopicsId = parseInt(process.env.TELEGRAM_AIRDROP_TOPICS_ID || '142362', 10)

  if (!token) {
    return NextResponse.json({ message: 'TELEGRAM_BOT_TOKEN not configured.' }, { status: 503 })
  }

  let body: {
    id?: unknown
    telegram_user_id?: unknown
    amount?: unknown
    _telegram_user?: { username?: string; telegram_id?: string | number }
    diamonds?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  const { id, amount, telegram_user_id, _telegram_user, diamonds } = body
  if (!id || amount == null || !telegram_user_id || !_telegram_user || !_telegram_user.telegram_id || diamonds == null) {
    return NextResponse.json({ message: 'Missing required parameters.' }, { status: 400 })
  }

  const username = _telegram_user.username?.trim()
    ? `@${_telegram_user.username}`
    : abbreviateUserId(_telegram_user.telegram_id)
  const message = `🟠 [${username}](tg://user?id=${_telegram_user.telegram_id}) requested to swap ${diamonds} 💎 for ${amount} $SCLAIM`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: airdropTopicsId,
        text: message,
        parse_mode: 'Markdown'
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Telegram API error:', err)
      return NextResponse.json({ message: 'Error sending message.' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Message sent successfully!' })
  } catch (error) {
    console.error('Error in /api/send-to-group:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (msg.includes('abort')) {
      return NextResponse.json({ message: 'Request timed out.' }, { status: 504 })
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}

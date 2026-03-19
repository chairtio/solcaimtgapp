import { NextResponse } from 'next/server'
import { getInitDataFromRequest, validateInitData } from '@/lib/telegram-auth'

/**
 * GET /api/test-telegram-group
 * Diagnostic: checks if Telegram env vars are set and tries to send a test message.
 * Call after deploy to verify claim notifications will work.
 */
export async function GET(request: Request) {
  // Require either valid Telegram initData or internal service secret.
  const internalSecret = process.env.INTERNAL_API_SECRET?.trim()
  const providedInternalSecret = request.headers.get('X-Internal-Api-Secret')?.trim()
  const initData = getInitDataFromRequest(request)
  const validInitData = initData ? validateInitData(initData) : null
  const internalAuthed = !!internalSecret && providedInternalSecret === internalSecret
  if (!validInitData && !internalAuthed) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID
  const topicId = parseInt(process.env.TELEGRAM_CLAIM_TOPICS_ID || '247118', 10)

  const status = {
    hasToken: !!token,
    hasChatId: !!chatId,
    topicId,
    error: null as string | null,
    sent: false
  }

  if (!token || !chatId) {
    status.error = 'TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_CHAT_ID not set. Add them in Vercel → Project Settings → Environment Variables.'
    return NextResponse.json(status, { status: 503 })
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: topicId,
        text: '🔧 Test message from SolClaim mini app – claim notifications are configured correctly.',
        parse_mode: 'HTML'
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      status.error = data.description || `Telegram API ${res.status}: ${JSON.stringify(data)}`
      return NextResponse.json(status, { status: 400 })
    }
    status.sent = true
  } catch (e) {
    status.error = e instanceof Error ? e.message : String(e)
  }
  return NextResponse.json(status)
}

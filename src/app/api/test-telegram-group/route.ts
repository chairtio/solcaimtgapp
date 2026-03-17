import { NextResponse } from 'next/server'

/**
 * GET /api/test-telegram-group
 * Diagnostic: checks if Telegram env vars are set and tries to send a test message.
 * Call after deploy to verify claim notifications will work.
 */
export async function GET() {
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

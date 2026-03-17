import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUser, markUserBotBlocked } from '@/lib/database'

const RATE_LIMIT_MS = 550 // ~2 msg/sec

type SendOpts = {
  message: string
  replyMarkup?: { inline_keyboard: { text: string; url?: string; callback_data?: string }[][] }
  media_type?: string | null
  media_url?: string | null
}

async function sendTelegramMessage(token: string, chatId: string, opts: SendOpts) {
  const baseOpts = {
    parse_mode: 'HTML' as const,
    disable_web_page_preview: true,
  }
  const body: Record<string, unknown> = {
    chat_id: chatId,
    ...baseOpts,
  }
  if (opts.replyMarkup?.inline_keyboard?.length) {
    body.reply_markup = JSON.stringify(opts.replyMarkup)
  }
  if (opts.media_type === 'image' && opts.media_url) {
    body.photo = opts.media_url
    body.caption = opts.message
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.description || 'Send failed')
    return json
  }
  if (opts.media_type === 'gif' && opts.media_url) {
    body.animation = opts.media_url
    body.caption = opts.message
    const res = await fetch(`https://api.telegram.org/bot${token}/sendAnimation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.description || 'Send failed')
    return json
  }
  body.text = opts.message
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.description || 'Send failed')
  return json
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 503 })
  }

  let body: { message: string; buttons?: { text: string; url?: string; callback_data?: string }[]; media_type?: string; media_url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, buttons, media_type, media_url } = body
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const adminUser = await getUser(auth.telegramId)
  const adminUserId = adminUser?.id ?? null

  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, telegram_id')
    .is('bot_blocked_at', null)

  if (usersError) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  const recipients = (users || []).map((u) => u.telegram_id)
  const totalRecipients = recipients.length

  const replyMarkup =
    buttons?.length && buttons.length > 0
      ? {
          inline_keyboard: [buttons.map((b) => ({ text: b.text, url: b.url, callback_data: b.callback_data }))],
        }
      : undefined

  const { data: logRow, error: logError } = await supabaseAdmin
    .from('broadcast_log')
    .insert({
      admin_user_id: adminUserId,
      message,
      buttons: buttons ?? null,
      media_type: media_type ?? null,
      media_url: media_url ?? null,
      total_recipients: totalRecipients,
      status: 'sending',
    })
    .select('id')
    .single()

  if (logError || !logRow) {
    return NextResponse.json({ error: 'Failed to create broadcast log' }, { status: 500 })
  }

  const logId = logRow.id
  let sentCount = 0
  let blockedCount = 0
  let errorCount = 0

  const sendOpts: SendOpts = {
    message,
    media_type: media_type || null,
    media_url: media_url || null,
  }
  if (replyMarkup) sendOpts.replyMarkup = replyMarkup

  for (const telegramId of recipients) {
    try {
      await sendTelegramMessage(token, String(telegramId), sendOpts)
      sentCount++
    } catch (err: unknown) {
      const code = (err as { response?: { error_code?: number } })?.response?.error_code
      if (code === 403) {
        await markUserBotBlocked(String(telegramId))
        blockedCount++
      } else {
        errorCount++
      }
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
  }

  await supabaseAdmin
    .from('broadcast_log')
    .update({
      sent_count: sentCount,
      blocked_count: blockedCount,
      error_count: errorCount,
      status: 'finished',
      finished_at: new Date().toISOString(),
    })
    .eq('id', logId)

  return NextResponse.json({
    success: true,
    logId,
    totalRecipients,
    sentCount,
    blockedCount,
    errorCount,
  })
}

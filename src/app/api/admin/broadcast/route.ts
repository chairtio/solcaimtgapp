import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUser, markUserBotBlocked } from '@/lib/database'
import {
  getFilteredBroadcastRecipients,
  type AudienceFilters,
} from '@/lib/broadcast-audience'

const RATE_LIMIT_MS = Number(process.env.BROADCAST_RATE_MS) || 50
const MAX_429_RETRIES = 3

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

  try {
    const { data, error } = await supabaseAdmin
      .from('broadcast_log')
      .select('id, message, status, total_recipients, sent_count, blocked_count, error_count, audience_filters, created_at, finished_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json({ broadcasts: data || [] })
  } catch (err) {
    console.error('[Admin broadcasts list]', err)
    return NextResponse.json({ error: 'Failed to fetch broadcasts' }, { status: 500 })
  }
}

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
  if (!json.ok) {
    const err = new Error(json.description || 'Send failed') as Error & { error_code?: number; retry_after?: number }
    err.error_code = json.error_code
    err.retry_after = json.parameters?.retry_after
    throw err
  }
  return json
}

async function sendTelegramMessageWithRetry(
  token: string,
  chatId: string,
  opts: SendOpts
): Promise<'sent' | 'blocked' | 'error'> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    try {
      await sendTelegramMessage(token, chatId, opts)
      return 'sent'
    } catch (err: unknown) {
      lastErr = err
      const e = err as Error & { error_code?: number; retry_after?: number }
      if (e.error_code === 429 && attempt < MAX_429_RETRIES) {
        const waitMs = (e.retry_after ?? 5) * 1000
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      if (e.error_code === 403) return 'blocked'
      return 'error'
    }
  }
  return 'error'
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 503 })
  }

  let body: {
    message: string
    buttons?: { text: string; url?: string; callback_data?: string }[]
    media_type?: string
    media_url?: string
    audienceFilters?: AudienceFilters
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, buttons, media_type, media_url, audienceFilters } = body
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const adminUser = await getUser(auth.telegramId)
  const adminUserId = adminUser?.id ?? null

  const recipients = await getFilteredBroadcastRecipients(audienceFilters ?? {})
  const totalRecipients = recipients.length

  if (totalRecipients === 0) {
    return NextResponse.json({ error: 'No users match the audience filters (or all are blocked)' }, { status: 400 })
  }

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
      audience_filters: audienceFilters ?? null,
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

  for (const recipient of recipients) {
    const status = await sendTelegramMessageWithRetry(token, String(recipient.telegram_id), sendOpts)
    if (status === 'sent') {
      sentCount++
      await supabaseAdmin
        .from('broadcast_recipients')
        .insert({ broadcast_id: logId, user_id: recipient.id, status: 'sent' })
        .then(() => {})
    } else if (status === 'blocked') {
      blockedCount++
      await markUserBotBlocked(String(recipient.telegram_id))
      await supabaseAdmin
        .from('broadcast_recipients')
        .insert({ broadcast_id: logId, user_id: recipient.id, status: 'blocked' })
        .then(() => {})
    } else {
      errorCount++
      await supabaseAdmin
        .from('broadcast_recipients')
        .insert({ broadcast_id: logId, user_id: recipient.id, status: 'error' })
        .then(() => {})
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

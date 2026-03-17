import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const token = process.env.TELEGRAM_BOT_TOKEN

async function sendToTelegram(
  chatId: string,
  message: string,
  opts: { buttons?: { text: string; url?: string; callback_data?: string }[]; media_type?: string; media_url?: string }
) {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')
  const baseOpts = {
    parse_mode: 'HTML' as const,
    disable_web_page_preview: true,
  }
  const replyMarkup =
    opts.buttons?.length && opts.buttons.length > 0
      ? { inline_keyboard: [opts.buttons.map((b) => ({ text: b.text, url: b.url, callback_data: b.callback_data }))] }
      : undefined

  if (opts.media_type === 'image' && opts.media_url) {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      photo: opts.media_url,
      caption: message,
      ...baseOpts,
    }
    if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup)
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
    const body: Record<string, unknown> = {
      chat_id: chatId,
      animation: opts.media_url,
      caption: message,
      ...baseOpts,
    }
    if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup)
    const res = await fetch(`https://api.telegram.org/bot${token}/sendAnimation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.description || 'Send failed')
    return json
  }
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: message,
    ...baseOpts,
  }
  if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup)
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

  try {
    const body = await request.json()
    const { message, buttons, media_type, media_url, follow_up_id } = body

    let messageToSend = message
    let buttonsToSend = buttons
    let mediaType = media_type
    let mediaUrl = media_url

    if (follow_up_id) {
      const { data: fu, error } = await supabaseAdmin
        .from('follow_up_messages')
        .select('message, buttons, media_type, media_url')
        .eq('id', follow_up_id)
        .single()
      if (error || !fu) {
        return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 })
      }
      messageToSend = fu.message
      buttonsToSend = fu.buttons
      mediaType = fu.media_type
      mediaUrl = fu.media_url
    }

    if (!messageToSend || typeof messageToSend !== 'string') {
      return NextResponse.json({ error: 'message or follow_up_id required' }, { status: 400 })
    }

    const adminTelegramId = String(auth.telegramId)
    await sendToTelegram(adminTelegramId, messageToSend, {
      buttons: buttonsToSend,
      media_type: mediaType,
      media_url: mediaUrl,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin preview]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Preview failed' },
      { status: 500 }
    )
  }
}

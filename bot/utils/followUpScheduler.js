/**
 * Follow-up drip campaign scheduler - Supabase-powered (replaces Redis reminderScheduler).
 * Sends follow_up_messages to users based on segment (not_claimed vs claimed) and delay_minutes.
 * Skips users who blocked the bot (bot_blocked_at IS NOT NULL).
 */
import Bottleneck from 'bottleneck'
import { getSupabase, markUserBotBlocked } from '../lib/supabase-bot.js'

const INTERVAL_MS = 10 * 60 * 1000 // 10 minutes
const RATE_LIMIT_MS = 600 // ~1.5 msg/sec to stay under Telegram limits

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: RATE_LIMIT_MS,
})

async function sendFollowUp(bot, telegramId, followUp) {
  const opts = {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (followUp.buttons && Array.isArray(followUp.buttons) && followUp.buttons.length > 0) {
    opts.reply_markup = {
      inline_keyboard: [followUp.buttons.map((b) => ({ text: b.text, url: b.url, callback_data: b.callback_data }))],
    }
  }

  try {
    if (followUp.media_type === 'image' && followUp.media_url) {
      await bot.telegram.sendPhoto(telegramId, followUp.media_url, { caption: followUp.message, ...opts })
    } else if (followUp.media_type === 'gif' && followUp.media_url) {
      await bot.telegram.sendAnimation(telegramId, followUp.media_url, { caption: followUp.message, ...opts })
    } else {
      await bot.telegram.sendMessage(telegramId, followUp.message, opts)
    }
    return { success: true }
  } catch (err) {
    if (err.response && err.response.error_code === 403) {
      await markUserBotBlocked(String(telegramId)).catch((e) => console.error('[followUpScheduler] markUserBotBlocked:', e.message))
      return { blocked: true }
    }
    throw err
  }
}

async function runFollowUpCycle(bot) {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('[followUpScheduler] Supabase not configured')
    return
  }

  try {
    const { data: followUps, error: fuError } = await supabase
      .from('follow_up_messages')
      .select('id, segment, delay_minutes, message, buttons, media_type, media_url')
      .eq('enabled', true)
      .order('sort', { ascending: true })
      .order('delay_minutes', { ascending: true })

    if (fuError) throw fuError
    if (!followUps || followUps.length === 0) return

    const now = new Date()
    const cutoff = new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000) // Users created in last 16 days (covers 14-day follow-ups)

    const { data: users, error: uError } = await supabase
      .from('users')
      .select('id, telegram_id, created_at')
      .is('bot_blocked_at', null)
      .gte('created_at', cutoff.toISOString())

    if (uError) throw uError
    if (!users || users.length === 0) return

    const userIds = users.map((u) => u.id)
    const userByTelId = new Map(users.map((u) => [u.telegram_id, u]))

    const { data: claimTotals } = await supabase.from('user_claim_totals').select('user_id, total_sol').in('user_id', userIds)
    const claimedUserIds = new Set((claimTotals || []).filter((r) => Number(r.total_sol || 0) > 0).map((r) => r.user_id))

    const { data: sentRows } = await supabase
      .from('follow_up_sent')
      .select('user_id, follow_up_id')
      .in('user_id', userIds)
      .in('follow_up_id', followUps.map((f) => f.id))

    const sentSet = new Set((sentRows || []).map((r) => `${r.user_id}:${r.follow_up_id}`))

    const delayMs = (mins) => mins * 60 * 1000

    for (const fu of followUps) {
      const eligible = users.filter((u) => {
        const key = `${u.id}:${fu.id}`
        if (sentSet.has(key)) return false

        const created = new Date(u.created_at).getTime()
        if (now.getTime() - created < delayMs(fu.delay_minutes)) return false

        if (fu.segment === 'not_claimed') return !claimedUserIds.has(u.id)
        if (fu.segment === 'claimed') return claimedUserIds.has(u.id)
        return false
      })

      for (const u of eligible) {
        await limiter.schedule(() => sendFollowUp(bot, u.telegram_id, fu))
          .then(async (result) => {
            if (result.success) {
              await supabase.from('follow_up_sent').insert({ user_id: u.id, follow_up_id: fu.id })
              console.log(`[followUpScheduler] Sent follow-up ${fu.id} to ${u.telegram_id}`)
            }
          })
          .catch((e) => console.error(`[followUpScheduler] Send failed for ${u.telegram_id}:`, e.message))
      }
    }
  } catch (err) {
    console.error('[followUpScheduler] Error:', err.message)
  }
}

export function scheduleFollowUpChecks(bot) {
  runFollowUpCycle(bot).catch(() => {})
  setInterval(() => runFollowUpCycle(bot).catch(() => {}), INTERVAL_MS)
  console.log('[followUpScheduler] Started (every 10 min)')
}

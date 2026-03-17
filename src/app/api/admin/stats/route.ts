import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getTotalClaimed, getTotalClaimingUsers } from '@/lib/database'

function getRangeStart(range: string): string | null {
  const now = new Date()
  switch (range) {
    case 'today': {
      const start = new Date(now)
      start.setUTCHours(0, 0, 0, 0)
      return start.toISOString()
    }
    case '7d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return start.toISOString()
    }
    case '30d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return start.toISOString()
    }
    default:
      return null
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') || ''
  const rangeStart = getRangeStart(range)

  try {
    const baseQueries = [
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('wallets').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).not('bot_blocked_at', 'is', null),
      getTotalClaimed(),
      getTotalClaimingUsers(),
      supabaseAdmin
        .from('users')
        .select('id, telegram_id, username, first_name, last_name, created_at, bot_blocked_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin.from('user_claim_totals').select('user_id').eq('has_claim_rent', true),
    ]

    const rangeQueries = rangeStart
      ? [
          supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', rangeStart),
          supabaseAdmin.from('transactions').select('*', { count: 'exact', head: true }).gte('created_at', rangeStart),
          supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'sent').not('sent_at', 'is', null).gte('sent_at', rangeStart),
          supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
          supabaseAdmin.from('broadcast_log').select('id', { count: 'exact', head: true }).eq('status', 'finished').gte('finished_at', rangeStart),
          supabaseAdmin.from('follow_up_sent').select('id', { count: 'exact', head: true }).gte('sent_at', rangeStart),
        ]
      : []

    const allResults = await Promise.all([...baseQueries, ...rangeQueries])

    const totalUsers = (allResults[0] as { count?: number })?.count ?? 0
    const totalWallets = (allResults[1] as { count?: number })?.count ?? 0
    const botBlockedCount = (allResults[2] as { count?: number })?.count ?? 0
    const totalClaimed = allResults[3] as number
    const usersWhoClaimed = allResults[4] as number
    const recentSignupsRes = allResults[5] as { data: Record<string, unknown>[] }
    const claimedUserIdsRes = allResults[6] as { data: { user_id: string }[] }
    const rangeResults = allResults.slice(7) as { count?: number }[]

    const claimedSet = new Set((claimedUserIdsRes.data || []).map((r: { user_id: string }) => r.user_id))

    const recent = (recentSignupsRes.data || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      telegram_id: u.telegram_id,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      created_at: u.created_at,
      bot_blocked_at: u.bot_blocked_at,
      has_claimed: claimedSet.has(u.id as string),
    }))

    const result: Record<string, unknown> = {
      totalUsers: totalUsers ?? 0,
      totalWallets: totalWallets ?? 0,
      usersWhoClaimed,
      totalClaimed,
      botBlockedCount: botBlockedCount ?? 0,
      recentSignups: recent,
    }

    if (rangeStart && rangeResults.length >= 6) {
      result.range = range
      result.newSignups = rangeResults[0]?.count ?? 0
      result.newClaims = rangeResults[1]?.count ?? 0
      result.campaignsSent = rangeResults[2]?.count ?? 0
      result.campaignsScheduled = rangeResults[3]?.count ?? 0
      result.broadcastsSent = rangeResults[4]?.count ?? 0
      result.followUpsSent = rangeResults[5]?.count ?? 0
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[Admin stats]', err)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

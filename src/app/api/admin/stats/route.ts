import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getTotalClaimed, getTotalClaimingUsers } from '@/lib/database'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const [
      { count: totalUsers },
      { count: totalWallets },
      { count: botBlockedCount },
      totalClaimed,
      usersWhoClaimed,
      recentSignupsRes,
      claimedUserIdsRes,
    ] = await Promise.all([
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
    ])

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

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      totalWallets: totalWallets ?? 0,
      usersWhoClaimed,
      totalClaimed,
      botBlockedCount: botBlockedCount ?? 0,
      recentSignups: recent,
    })
  } catch (err) {
    console.error('[Admin stats]', err)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

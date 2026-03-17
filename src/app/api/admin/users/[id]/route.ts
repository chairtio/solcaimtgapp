import { NextResponse } from 'next/server'
import { requireAdmin } from '../../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  getUserById,
  getUserStats,
  getRecentClaims,
  getUserReferrals,
} from '@/lib/database'
import type { Wallet } from '@/lib/database'

// Re-export getWallets - database has it but we need all wallets including inactive for admin
async function getWalletsForUser(userId: string): Promise<Wallet[]> {
  const { data, error } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { id: userId } = await params

  try {
    const [user, stats, wallets, recentClaims, refsAsReferrer, refsAsReferee, followUpsSentRows, followUpMessages] = await Promise.all([
      getUserById(userId),
      getUserStats(userId),
      getWalletsForUser(userId),
      getRecentClaims(userId, 20),
      getUserReferrals(userId),
      supabaseAdmin.from('referrals').select('id').eq('referee_id', userId),
      supabaseAdmin.from('follow_up_sent').select('follow_up_id, sent_at').eq('user_id', userId),
      supabaseAdmin.from('follow_up_messages').select('id, name, delay_minutes, segment').eq('enabled', true).order('sort', { ascending: true }),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hasClaimed = Number(stats?.total_sol_claimed || 0) > 0 || Number(stats?.total_accounts_closed || 0) > 0
    const sentFollowUpIds = new Set((followUpsSentRows?.data || []).map((r) => r.follow_up_id))
    const followUpById = new Map((followUpMessages?.data || []).map((f) => [f.id, f]))
    const userCreatedAt = new Date(user.created_at).getTime()

    const followUpsSent = (followUpsSentRows?.data || []).map((r) => {
      const fu = followUpById.get(r.follow_up_id)
      return {
        follow_up_id: r.follow_up_id,
        name: fu?.name || '—',
        delay_minutes: fu?.delay_minutes,
        sent_at: r.sent_at,
        status: 'sent' as const,
      }
    })

    const followUpsScheduled: { follow_up_id: string; name: string; delay_minutes: number; scheduled_at: string; status: 'scheduled' }[] = []
    const now = Date.now()
    for (const fu of followUpMessages?.data || []) {
      if (sentFollowUpIds.has(fu.id)) continue
      const segmentMatch = (fu.segment === 'not_claimed' && !hasClaimed) || (fu.segment === 'claimed' && hasClaimed)
      if (!segmentMatch) continue
      const scheduledAt = new Date(userCreatedAt + fu.delay_minutes * 60 * 1000)
      if (scheduledAt.getTime() <= now) {
        followUpsScheduled.push({
          follow_up_id: fu.id,
          name: fu.name || '—',
          delay_minutes: fu.delay_minutes,
          scheduled_at: scheduledAt.toISOString(),
          status: 'scheduled',
        })
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        photo_url: user.photo_url,
        is_premium: user.is_premium,
        receiver_wallet: user.receiver_wallet,
        created_at: user.created_at,
        bot_blocked_at: (user as { bot_blocked_at?: string }).bot_blocked_at,
      },
      stats,
      wallets: wallets.map((w) => ({
        id: w.id,
        public_key: w.public_key,
        status: w.status,
        created_at: w.created_at,
      })),
      recentClaims,
      referralsAsReferrer: refsAsReferrer.length,
      referralsAsReferee: (refsAsReferee.data || []).length,
      followUpsSent,
      followUpsScheduled,
    })
  } catch (err) {
    console.error('[Admin user detail]', err)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

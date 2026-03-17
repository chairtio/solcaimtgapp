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
    const [user, stats, wallets, recentClaims, refsAsReferrer, refsAsReferee] = await Promise.all([
      getUserById(userId),
      getUserStats(userId),
      getWalletsForUser(userId),
      getRecentClaims(userId, 20),
      getUserReferrals(userId),
      supabaseAdmin.from('referrals').select('id').eq('referee_id', userId),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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
    })
  } catch (err) {
    console.error('[Admin user detail]', err)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

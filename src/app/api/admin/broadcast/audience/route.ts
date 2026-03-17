import { NextResponse } from 'next/server'
import { requireAdmin } from '../../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ClaimedFilter = 'all' | 'yes' | 'no'
type HasReferralsFilter = 'all' | 'yes' | 'no'

/**
 * GET /api/admin/broadcast/audience
 * Query: claimed=all|yes|no, has_referrals=all|yes|no
 * Returns count of users matching filters (always excludes bot_blocked_at).
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const claimed = (searchParams.get('claimed') || 'all') as ClaimedFilter
  const hasReferrals = (searchParams.get('has_referrals') || 'all') as HasReferralsFilter

  try {
    const [usersRes, claimedRes, referrerRes] = await Promise.all([
      supabaseAdmin.from('users').select('id').is('bot_blocked_at', null),
      supabaseAdmin.from('user_claim_totals').select('user_id').eq('has_claim_rent', true),
      supabaseAdmin.from('referrals').select('referrer_id'),
    ])

    if (usersRes.error) throw usersRes.error

    const claimedSet = new Set((claimedRes.data || []).map((r) => r.user_id))
    const referrerSet = new Set((referrerRes.data || []).map((r) => r.referrer_id))

    let filtered = (usersRes.data || []).map((u) => u.id)
    if (claimed === 'yes') filtered = filtered.filter((id) => claimedSet.has(id))
    else if (claimed === 'no') filtered = filtered.filter((id) => !claimedSet.has(id))
    if (hasReferrals === 'yes') filtered = filtered.filter((id) => referrerSet.has(id))
    else if (hasReferrals === 'no') filtered = filtered.filter((id) => !referrerSet.has(id))

    const totalNonBlocked = (usersRes.data || []).length
    const breakdown = {
      claimed: claimedSet.size,
      not_claimed: totalNonBlocked - claimedSet.size,
      has_referrals: referrerSet.size,
      no_referrals: totalNonBlocked - referrerSet.size,
    }

    return NextResponse.json({ count: filtered.length, breakdown })
  } catch (err) {
    console.error('[Admin broadcast audience]', err)
    return NextResponse.json({ error: 'Failed to fetch audience' }, { status: 500 })
  }
}

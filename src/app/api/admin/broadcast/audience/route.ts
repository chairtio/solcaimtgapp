import { NextResponse } from 'next/server'
import { requireAdmin } from '../../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ClaimedFilter = 'all' | 'yes' | 'no'
type HasReferralsFilter = 'all' | 'yes' | 'no'

/**
 * GET /api/admin/broadcast/audience
 * Query: claimed=all|yes|no, has_referrals=all|yes|no
 * Uses RPC to bypass Supabase 1000-row limit. Returns count and breakdown.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const claimed = (searchParams.get('claimed') || 'all') as ClaimedFilter
  const hasReferrals = (searchParams.get('has_referrals') || 'all') as HasReferralsFilter

  try {
    const { data, error } = await supabaseAdmin.rpc('get_broadcast_audience_count', {
      p_claimed: claimed,
      p_has_referrals: hasReferrals,
    })

    if (error) throw error

    const row = Array.isArray(data) && data.length > 0 ? data[0] : data
    const count = Number(row?.count ?? 0)
    const breakdown = {
      claimed: Number(row?.claimed ?? 0),
      not_claimed: Number(row?.not_claimed ?? 0),
      has_referrals: Number(row?.has_referrals ?? 0),
      no_referrals: Number(row?.no_referrals ?? 0),
    }

    return NextResponse.json({ count, breakdown })
  } catch (err) {
    console.error('[Admin broadcast audience]', err)
    return NextResponse.json({ error: 'Failed to fetch audience' }, { status: 500 })
  }
}

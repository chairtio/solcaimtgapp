import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Campaign id required' }, { status: 400 })
  }

  try {
    const { data: attributions, error: attrError } = await supabaseAdmin
      .from('ad_campaign_attribution')
      .select('user_id')
      .eq('ad_campaign_id', id)

    if (attrError) throw attrError
    const userIds = (attributions || []).map((r) => r.user_id)
    const started = userIds.length

    if (userIds.length === 0) {
      return NextResponse.json({
        started: 0,
        added_wallet: 0,
        claimed: 0,
      })
    }

    const [walletsRes, claimedRes] = await Promise.all([
      supabaseAdmin
        .from('wallets')
        .select('user_id')
        .in('user_id', userIds),
      supabaseAdmin
        .from('user_claim_totals')
        .select('user_id')
        .in('user_id', userIds)
        .eq('has_claim_rent', true),
    ])

    const usersWithWallet = new Set((walletsRes.data || []).map((r) => r.user_id))
    const usersClaimed = new Set((claimedRes.data || []).map((r) => r.user_id))

    const added_wallet = usersWithWallet.size
    const claimed = usersClaimed.size

    return NextResponse.json({
      started,
      added_wallet,
      claimed,
    })
  } catch (err) {
    console.error('[Admin ad-campaigns stats]', err)
    return NextResponse.json({ error: 'Failed to fetch campaign stats' }, { status: 500 })
  }
}

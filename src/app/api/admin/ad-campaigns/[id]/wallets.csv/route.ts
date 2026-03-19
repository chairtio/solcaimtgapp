import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

function escapeCsv(value: unknown): string {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

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
    const [{ data: campaign, error: campError }, { data: attributions, error: attrError }] =
      await Promise.all([
        supabaseAdmin
          .from('ad_campaigns')
          .select('id, name, source_code')
          .eq('id', id)
          .maybeSingle(),
        supabaseAdmin
          .from('ad_campaign_attribution')
          .select('user_id')
          .eq('ad_campaign_id', id),
      ])

    if (campError) throw campError
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (attrError) throw attrError

    const userIds = (attributions || []).map((r) => r.user_id)
    if (userIds.length === 0) {
      const header =
        'campaign_id,campaign_name,source_code,user_id,telegram_id,username,wallet_id,public_key,status,wallet_created_at,has_claimed,total_sol_claimed,total_accounts_closed'
      return new NextResponse(header + '\n', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ad_campaign_${campaign.id}_wallets.csv"`,
        },
      })
    }

    const [usersRes, walletsRes, claimsRes] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, telegram_id, username')
        .in('id', userIds),
      supabaseAdmin
        .from('wallets')
        .select('id, user_id, public_key, status, created_at')
        .in('user_id', userIds),
      supabaseAdmin
        .from('user_claim_totals')
        .select('user_id, total_sol, total_accounts, has_claim_rent')
        .in('user_id', userIds),
    ])

    const users = usersRes.data || []
    const wallets = walletsRes.data || []
    const claims = claimsRes.data || []

    const userMap = new Map(users.map((u) => [u.id, u]))
    const claimMap = new Map(claims.map((c) => [c.user_id, c]))

    const header =
      'campaign_id,campaign_name,source_code,user_id,telegram_id,username,wallet_id,public_key,status,wallet_created_at,has_claimed,total_sol_claimed,total_accounts_closed'

    const rows = wallets.map((w) => {
      const user = userMap.get(w.user_id)
      const claim = claimMap.get(w.user_id)
      const hasClaimed = claim?.has_claim_rent ? 'true' : 'false'
      const totalSol = claim ? Number(claim.total_sol || 0) : 0
      const totalAccounts = claim ? Number(claim.total_accounts || 0) : 0

      const cols = [
        campaign.id,
        campaign.name,
        campaign.source_code,
        w.user_id,
        user?.telegram_id ?? '',
        user?.username ?? '',
        w.id,
        w.public_key,
        w.status,
        w.created_at,
        hasClaimed,
        totalSol,
        totalAccounts,
      ]

      return cols.map(escapeCsv).join(',')
    })

    const csv = [header, ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ad_campaign_${campaign.id}_wallets.csv"`,
      },
    })
  } catch (err) {
    console.error('[Admin ad-campaigns wallets export]', err)
    return NextResponse.json(
      { error: 'Failed to export campaign wallets' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

type TimeBucket = {
  date: string
  started: number
  added_wallet: number
  claimed: number
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
    const { data: attributions, error: attrError } = await supabaseAdmin
      .from('ad_campaign_attribution')
      .select('user_id, created_at')
      .eq('ad_campaign_id', id)

    if (attrError) throw attrError

    const userIds = (attributions || []).map((r) => r.user_id)
    const started = userIds.length

    if (!started) {
      return NextResponse.json({
        started: 0,
        added_wallet: 0,
        claimed: 0,
        conversion: {
          started_to_wallet: 0,
          wallet_to_claim: 0,
        },
        timeSeries: [],
        users: [],
      })
    }

    const [walletsRes, claimTotalsRes, usersRes] = await Promise.all([
      supabaseAdmin
        .from('wallets')
        .select('id, user_id, public_key, status, created_at')
        .in('user_id', userIds),
      supabaseAdmin
        .from('user_claim_totals')
        .select('user_id, total_sol, total_accounts, has_claim_rent, updated_at')
        .in('user_id', userIds),
      supabaseAdmin
        .from('users')
        .select('id, telegram_id, username, first_name, last_name, created_at')
        .in('id', userIds),
    ])

    const wallets = walletsRes.data || []
    const claimTotals = claimTotalsRes.data || []
    const users = usersRes.data || []

    const usersWithWallet = new Set(wallets.map((w) => w.user_id))
    const usersClaimed = new Set(
      claimTotals.filter((c) => c.has_claim_rent).map((c) => c.user_id)
    )

    const added_wallet = usersWithWallet.size
    const claimed = usersClaimed.size

    const started_to_wallet =
      started > 0 ? Number(((added_wallet / started) * 100).toFixed(2)) : 0
    const wallet_to_claim =
      added_wallet > 0 ? Number(((claimed / added_wallet) * 100).toFixed(2)) : 0

    const bucketMap = new Map<string, TimeBucket>()

    for (const row of attributions || []) {
      if (!row.created_at) continue
      const date = new Date(row.created_at).toISOString().slice(0, 10)
      let bucket = bucketMap.get(date)
      if (!bucket) {
        bucket = { date, started: 0, added_wallet: 0, claimed: 0 }
        bucketMap.set(date, bucket)
      }
      bucket.started += 1
    }

    for (const w of wallets) {
      if (!w.created_at) continue
      const date = new Date(w.created_at).toISOString().slice(0, 10)
      let bucket = bucketMap.get(date)
      if (!bucket) {
        bucket = { date, started: 0, added_wallet: 0, claimed: 0 }
        bucketMap.set(date, bucket)
      }
      bucket.added_wallet += 1
    }

    for (const c of claimTotals) {
      if (!c.has_claim_rent || !c.updated_at) continue
      const date = new Date(c.updated_at).toISOString().slice(0, 10)
      let bucket = bucketMap.get(date)
      if (!bucket) {
        bucket = { date, started: 0, added_wallet: 0, claimed: 0 }
        bucketMap.set(date, bucket)
      }
      bucket.claimed += 1
    }

    const timeSeries = Array.from(bucketMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )

    const claimsByUser = new Map(
      claimTotals.map((c) => [c.user_id, c])
    )

    const walletsByUser = new Map<string, typeof wallets>()
    for (const w of wallets) {
      const list = walletsByUser.get(w.user_id) || []
      list.push(w)
      walletsByUser.set(w.user_id, list)
    }

    const userDetails = users.map((u) => {
      const userWallets = walletsByUser.get(u.id) || []
      const claim = claimsByUser.get(u.id)
      const has_wallet = userWallets.length > 0
      const has_claimed = !!claim?.has_claim_rent

      return {
        id: u.id,
        telegram_id: u.telegram_id,
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name,
        created_at: u.created_at,
        has_wallet,
        has_claimed,
        total_sol_claimed: claim ? Number(claim.total_sol || 0) : 0,
        total_accounts_closed: claim ? Number(claim.total_accounts || 0) : 0,
        wallets: userWallets.map((w) => ({
          id: w.id,
          public_key: w.public_key,
          status: w.status,
          created_at: w.created_at,
        })),
      }
    })

    return NextResponse.json({
      started,
      added_wallet,
      claimed,
      conversion: {
        started_to_wallet,
        wallet_to_claim,
      },
      timeSeries,
      users: userDetails,
    })
  } catch (err) {
    console.error('[Admin ad-campaigns detail]', err)
    return NextResponse.json({ error: 'Failed to fetch campaign detail' }, { status: 500 })
  }
}


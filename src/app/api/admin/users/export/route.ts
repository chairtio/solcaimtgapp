import { NextResponse } from 'next/server'
import { requireAdmin } from '../../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const blocked = searchParams.get('blocked') ?? ''
  const claimed = searchParams.get('claimed') ?? ''
  const limit = Math.min(Number(searchParams.get('limit')) || 5000, 10000)

  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, telegram_id, username, first_name, last_name, created_at, bot_blocked_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (blocked === 'true') {
      query = query.not('bot_blocked_at', 'is', null)
    } else if (blocked === 'false') {
      query = query.is('bot_blocked_at', null)
    }

    const { data: usersData, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const claimedRes = await supabaseAdmin
      .from('user_claim_totals')
      .select('user_id')
      .eq('has_claim_rent', true)
    const claimedSet = new Set((claimedRes.data || []).map((r: { user_id: string }) => r.user_id))

    let mapped = (usersData || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      telegram_id: u.telegram_id,
      username: u.username ?? '',
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      created_at: u.created_at,
      bot_blocked_at: u.bot_blocked_at ? 'Yes' : 'No',
      has_claimed: claimedSet.has(u.id as string) ? 'Yes' : 'No',
    }))

    if (claimed === 'true') mapped = mapped.filter((u) => u.has_claimed === 'Yes')
    if (claimed === 'false') mapped = mapped.filter((u) => u.has_claimed === 'No')

    const escapeCsv = (v: unknown) => {
      const s = String(v ?? '')
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }

    const header = 'id,telegram_id,username,first_name,last_name,created_at,bot_blocked,has_claimed'
    const rows = mapped.map(
      (u) =>
        [u.id, u.telegram_id, u.username, u.first_name, u.last_name, u.created_at, u.bot_blocked_at, u.has_claimed]
          .map(escapeCsv)
          .join(',')
    )
    const csv = [header, ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    console.error('[Admin users export]', err)
    return NextResponse.json({ error: 'Failed to export users' }, { status: 500 })
  }
}

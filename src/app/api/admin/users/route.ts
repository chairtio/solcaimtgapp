import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const blocked = searchParams.get('blocked') ?? ''
  const claimed = searchParams.get('claimed') ?? '' // 'true' | 'false' - filter by has_claim_rent
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, telegram_id, username, first_name, last_name, created_at, bot_blocked_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (blocked === 'true') {
      query = query.not('bot_blocked_at', 'is', null)
    } else if (blocked === 'false') {
      query = query.is('bot_blocked_at', null)
    }

    if (search.trim()) {
      const term = `%${search.trim()}%`
      query = query.or(`telegram_id.ilike.${term},username.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[Admin users]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const claimedRes = await supabaseAdmin
      .from('user_claim_totals')
      .select('user_id')
      .eq('has_claim_rent', true)
    const claimedSet = new Set((claimedRes.data || []).map((r: { user_id: string }) => r.user_id))

    let mapped = (data || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      telegram_id: u.telegram_id,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      created_at: u.created_at,
      bot_blocked_at: u.bot_blocked_at,
      has_claimed: claimedSet.has(u.id as string),
    }))

    if (claimed === 'true') mapped = mapped.filter((u) => u.has_claimed)
    if (claimed === 'false') mapped = mapped.filter((u) => !u.has_claimed)

    const users = mapped

    return NextResponse.json({ users, total: count ?? 0 })
  } catch (err) {
    console.error('[Admin users]', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

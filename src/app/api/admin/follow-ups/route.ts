import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const { data, error } = await supabaseAdmin
      .from('follow_up_messages')
      .select('*')
      .order('sort', { ascending: true })
      .order('delay_minutes', { ascending: true })

    if (error) throw error
    return NextResponse.json({ followUps: data || [] })
  } catch (err) {
    console.error('[Admin follow-ups list]', err)
    return NextResponse.json({ error: 'Failed to fetch follow-ups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { delay_minutes, message, buttons, enabled = true, sort = 0 } = body

    if (delay_minutes == null || !message) {
      return NextResponse.json({ error: 'delay_minutes and message required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('follow_up_messages')
      .insert({
        delay_minutes: Number(delay_minutes),
        message: String(message),
        buttons: buttons || null,
        enabled: Boolean(enabled),
        sort: Number(sort) || 0,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Admin follow-ups create]', err)
    return NextResponse.json({ error: 'Failed to create follow-up' }, { status: 500 })
  }
}

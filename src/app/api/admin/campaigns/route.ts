import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ campaigns: data || [] })
  } catch (err) {
    console.error('[Admin campaigns list]', err)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { name, message, buttons, status = 'draft', scheduled_at } = body

    if (!name || !message) {
      return NextResponse.json({ error: 'name and message required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        name: String(name),
        message: String(message),
        buttons: buttons || null,
        status: ['draft', 'scheduled', 'sent', 'cancelled'].includes(status) ? status : 'draft',
        scheduled_at: scheduled_at || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Admin campaigns create]', err)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}

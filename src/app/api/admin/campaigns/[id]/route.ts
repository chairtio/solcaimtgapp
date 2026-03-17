import { NextResponse } from 'next/server'
import { requireAdmin } from '../../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Admin campaign get]', err)
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name != null) updates.name = String(body.name)
    if (body.message != null) updates.message = String(body.message)
    if (body.buttons != null) updates.buttons = body.buttons
    if (body.status != null && ['draft', 'scheduled', 'sent', 'cancelled'].includes(body.status)) updates.status = body.status
    if (body.scheduled_at != null) updates.scheduled_at = body.scheduled_at
    if (body.sent_at != null) updates.sent_at = body.sent_at

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Admin campaign patch]', err)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin campaign delete]', err)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}

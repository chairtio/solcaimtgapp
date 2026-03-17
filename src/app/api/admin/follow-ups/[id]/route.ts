import { NextResponse } from 'next/server'
import { requireAdmin } from '../../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
    if (body.delay_minutes != null) updates.delay_minutes = Number(body.delay_minutes)
    if (body.message != null) updates.message = String(body.message)
    if (body.buttons != null) updates.buttons = body.buttons
    if (body.enabled != null) updates.enabled = Boolean(body.enabled)
    if (body.sort != null) updates.sort = Number(body.sort)

    const { data, error } = await supabaseAdmin
      .from('follow_up_messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Admin follow-up patch]', err)
    return NextResponse.json({ error: 'Failed to update follow-up' }, { status: 500 })
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
    const { error } = await supabaseAdmin.from('follow_up_messages').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin follow-up delete]', err)
    return NextResponse.json({ error: 'Failed to delete follow-up' }, { status: 500 })
  }
}

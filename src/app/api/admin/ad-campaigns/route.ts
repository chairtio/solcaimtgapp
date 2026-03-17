import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || 'solclaimxbot'
const SOURCE_CODE_PREFIX = 'camp_'
const SOURCE_CODE_RANDOM_LENGTH = 8

function generateSourceCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let suffix = ''
  for (let i = 0; i < SOURCE_CODE_RANDOM_LENGTH; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return SOURCE_CODE_PREFIX + suffix
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const { data, error } = await supabaseAdmin
      .from('ad_campaigns')
      .select('id, name, source_code, notes, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ campaigns: data || [] })
  } catch (err) {
    console.error('[Admin ad-campaigns list]', err)
    return NextResponse.json({ error: 'Failed to fetch ad campaigns' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const notes = typeof body?.notes === 'string' ? body.notes.trim() || null : null

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    let sourceCode = generateSourceCode()
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: existing } = await supabaseAdmin
        .from('ad_campaigns')
        .select('id')
        .eq('source_code', sourceCode)
        .maybeSingle()
      if (!existing) break
      sourceCode = generateSourceCode()
    }

    const { data, error } = await supabaseAdmin
      .from('ad_campaigns')
      .insert({
        name,
        source_code: sourceCode,
        notes,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    const botStartUrl = `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(sourceCode)}`
    const miniAppUrl = `https://t.me/${BOT_USERNAME}/app?startapp=${encodeURIComponent(sourceCode)}`

    return NextResponse.json({
      ...data,
      bot_start_url: botStartUrl,
      mini_app_url: miniAppUrl,
    })
  } catch (err) {
    console.error('[Admin ad-campaigns create]', err)
    return NextResponse.json({ error: 'Failed to create ad campaign' }, { status: 500 })
  }
}

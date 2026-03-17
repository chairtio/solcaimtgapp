import { NextResponse } from 'next/server'
import { getInitDataFromRequest } from '@/lib/telegram-auth'
import { validateInitData } from '@/lib/telegram-auth'
import { getUser } from '@/lib/database'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const initData = getInitDataFromRequest(request)
  if (!initData) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const validated = validateInitData(initData)
  if (!validated?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const telegramId = String(validated.user.id)

  let body: { source_code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const sourceCode = typeof body?.source_code === 'string' ? body.source_code.trim() : ''
  if (!sourceCode || sourceCode.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(sourceCode)) {
    return NextResponse.json({ ok: true, attributed: false })
  }

  const { data: campaign, error: campError } = await supabaseAdmin
    .from('ad_campaigns')
    .select('id')
    .eq('source_code', sourceCode)
    .single()

  if (campError || !campaign?.id) {
    return NextResponse.json({ ok: true, attributed: false })
  }

  const dbUser = await getUser(telegramId)
  if (!dbUser?.id) {
    return NextResponse.json({ ok: true, attributed: false })
  }

  const { error: attrError } = await supabaseAdmin
    .from('ad_campaign_attribution')
    .upsert(
      { user_id: dbUser.id, ad_campaign_id: campaign.id },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )

  return NextResponse.json({
    ok: true,
    attributed: !attrError,
  })
}

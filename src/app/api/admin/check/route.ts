import { NextResponse } from 'next/server'
import { requireAdmin } from '../withAdmin'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  return NextResponse.json({ isAdmin: true })
}

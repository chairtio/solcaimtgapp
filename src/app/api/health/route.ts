import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Health check endpoint to verify Supabase connectivity.
 * Hit GET /api/health after deploy to confirm env vars are set on Vercel.
 */
export async function GET(request: Request) {
  // Lock down in production: this endpoint touches privileged credentials.
  if (process.env.NODE_ENV === 'production') {
    const expected = process.env.HEALTHCHECK_SECRET?.trim()
    const provided = request.headers.get('X-Healthcheck-Secret')?.trim()
    if (!expected || provided !== expected) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_env_vars',
        message: 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Add them in Vercel project settings.',
      },
      { status: 503 }
    )
  }

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await supabase.from('users').select('id').limit(1)
    if (error && error.code === '42P01') {
      return NextResponse.json(
        {
          ok: false,
          error: 'tables_missing',
          message: 'Users table does not exist. Run supabase/migrations/001_initial_schema.sql in Supabase SQL Editor.',
        },
        { status: 503 }
      )
    }
    if (error) {
      return NextResponse.json(
        { ok: false, error: 'db_error', message: error.message },
        { status: 503 }
      )
    }
    return NextResponse.json({ ok: true, database: 'connected' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: 'connection_failed', message: msg },
      { status: 503 }
    )
  }
}

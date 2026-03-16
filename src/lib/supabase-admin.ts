import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// In dev, don't hard-crash if env vars are missing.
// Use obvious dummy values so it's clear something is misconfigured,
// but let the UI render.
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    'Supabase admin client: missing env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
  )
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseServiceKey || 'dev-service-role-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)
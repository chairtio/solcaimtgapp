/**
 * Import Xano telegram_users.csv into Supabase users table.
 * Run: npx tsx scripts/import-xano-users.ts
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const BATCH_SIZE = 500
const ROOT = process.cwd()

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : null
})()
const CSV_PATH = path.join(ROOT, 'xano', 'telegram_users.csv')

// Load .env.local
function loadEnv() {
  const envPath = path.join(ROOT, '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim().replace(/^["']|["']$/g, '')
        process.env[key] = value
      }
    }
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface XanoRow {
  id: string
  created_at: string
  telegram_id: string
  username: string
  withdrawal_wallet: string
  commission_percentage: string
  marketing_partner: string
  type: string
  used_trading_bot: string
}

function parseCSV(content: string): XanoRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  const rows: XanoRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',')
    const row: Record<string, string> = {}
    header.forEach((h, j) => {
      row[h] = vals[j] ?? ''
    })
    rows.push(row as unknown as XanoRow)
  }
  return rows
}

function mapToSupabaseUser(row: XanoRow) {
  const telegramId = String(row.telegram_id || '').trim()
  if (!telegramId) return null

  const createdMs = parseInt(row.created_at, 10)
  const createdAt = isNaN(createdMs)
    ? new Date().toISOString()
    : new Date(createdMs).toISOString()

  const withdrawalWallet = (row.withdrawal_wallet || '').trim()
  const receiverWallet = withdrawalWallet || null

  // Supabase users requires first_name NOT NULL. Xano only has username.
  const firstName = (row.username || '').trim() || 'User'

  return {
    telegram_id: telegramId,
    username: (row.username || '').trim() || null,
    first_name: firstName,
    last_name: null,
    photo_url: null,
    is_premium: false,
    receiver_wallet: receiverWallet,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

async function main() {
  console.log('Reading CSV from', CSV_PATH)
  const content = fs.readFileSync(CSV_PATH, 'utf-8')
  const rows = parseCSV(content)
  console.log(`Parsed ${rows.length} rows`)

  const users = rows
    .map(mapToSupabaseUser)
    .filter((u): u is NonNullable<typeof u> => u !== null)

  // Dedupe by telegram_id (keep last)
  const byTelegram = new Map<string, (typeof users)[0]>()
  for (const u of users) {
    byTelegram.set(u.telegram_id, u)
  }
  let unique = Array.from(byTelegram.values())
  if (LIMIT) {
    unique = unique.slice(0, LIMIT)
    console.log(`Limited to ${unique.length} users (--limit ${LIMIT})`)
  } else {
    console.log(`${unique.length} unique users (by telegram_id)`)
  }

  if (DRY_RUN) {
    console.log('[DRY RUN] Would upsert', unique.length, 'users. Sample:', JSON.stringify(unique[0], null, 2))
    return
  }

  let inserted = 0
  let errors = 0

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('users')
      .upsert(batch, {
        onConflict: 'telegram_id',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message)
      errors += batch.length
      continue
    }

    inserted += batch.length
    const pct = ((i + batch.length) / unique.length * 100).toFixed(1)
    process.stdout.write(`\rProgress: ${i + batch.length}/${unique.length} (${pct}%)`)
  }

  console.log('\n')
  console.log('Done:', { inserted, errors })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

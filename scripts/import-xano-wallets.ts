/**
 * Import Xano wallets.csv into Supabase wallets table.
 *
 * ID MAPPING:
 * - wallets.telegram_user_id = References telegram_users.id (Xano internal)
 * - telegram_users.telegram_id = Actual Telegram ID = Supabase users.telegram_id
 *
 * Run: npx tsx scripts/import-xano-wallets.ts
 *   --dry-run        Preview without inserting
 *   --limit N        Process only N wallets
 *
 * Requires: Run import-xano-users.ts first (users must exist).
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

const WALLETS_PATH = path.join(ROOT, 'xano', 'wallets.csv')
const USERS_PATH = path.join(ROOT, 'xano', 'telegram_users.csv')

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const vals = line.split(',')
    const row: Record<string, string> = {}
    header.forEach((h, j) => {
      row[h.trim()] = vals[j] ?? ''
    })
    return row
  })
}

/** Get value by header key; wallets.csv may have corrupted id column (e.g. 6N7hh1TTid) */
function getCol(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? ''
    if (v) return v.trim()
  }
  return ''
}

async function main() {
  if (!fs.existsSync(WALLETS_PATH)) {
    console.error('Missing xano/wallets.csv')
    process.exit(1)
  }

  // Load CSV data
  const walletsRaw = parseCSV(fs.readFileSync(WALLETS_PATH, 'utf-8'))
  const usersRaw = parseCSV(fs.readFileSync(USERS_PATH, 'utf-8'))

  if (walletsRaw.length === 0) {
    console.log('No wallet rows in CSV')
    return
  }

  const header = fs.readFileSync(WALLETS_PATH, 'utf-8').split(/\r?\n/)[0]?.split(',') ?? []
  const idKey = header.find((h) => h === 'id') ?? header[0]
  const pkKey = header.find((h) => h === 'public_key') ?? 'public_key'
  const privKey = header.find((h) => h === 'private_key') ?? 'private_key'

  // Map: Xano telegram_users.id -> telegram_id (actual)
  const xanoUserIdToTelegram = new Map<string, string>()
  for (const u of usersRaw) {
    const xanoId = (u.id ?? u.telegram_user_id ?? '').trim()
    const telegramId = (u.telegram_id ?? '').trim()
    if (xanoId && telegramId) xanoUserIdToTelegram.set(xanoId, telegramId)
  }

  // Map: telegram_id -> Supabase user_id (paginate - Supabase limits to 1000 rows/request)
  const telegramToSupabaseUser = new Map<string, string>()
  let userOffset = 0
  const userChunk = 1000
  while (true) {
    const { data } = await supabase
      .from('users')
      .select('id, telegram_id')
      .order('id', { ascending: true })
      .range(userOffset, userOffset + userChunk - 1)
    if (!data?.length) break
    for (const u of data) {
      const tid = u.telegram_id != null ? String(u.telegram_id) : ''
      if (tid) telegramToSupabaseUser.set(tid, u.id)
    }
    if (data.length < userChunk) break
    userOffset += userChunk
  }
  console.log(`Loaded ${telegramToSupabaseUser.size} Supabase users for mapping`)

  // Build wallet records for upsert
  const toUpsert: { user_id: string; public_key: string; encrypted_private_key: string | null; status: string }[] = []
  let skipNoUser = 0
  let skipNoSupabase = 0
  let skipNoPubkey = 0

  for (const w of walletsRaw) {
    const xanoId = getCol(w, [idKey, 'id', header[0]])
    const telegramUserId = (w.telegram_user_id ?? w.user_id ?? '').trim()
    const publicKey = getCol(w, [pkKey, 'public_key'])
    const privateKey = getCol(w, [privKey, 'private_key'])

    if (!publicKey) {
      skipNoPubkey++
      continue
    }

    const telegramId = xanoUserIdToTelegram.get(telegramUserId)
    if (!telegramId) {
      skipNoUser++
      continue
    }

    const supabaseUserId = telegramToSupabaseUser.get(telegramId)
    if (!supabaseUserId) {
      skipNoSupabase++
      continue
    }

    toUpsert.push({
      user_id: supabaseUserId,
      public_key: publicKey,
      encrypted_private_key: privateKey || null,
      status: 'active',
    })
  }

  // Dedupe by (user_id, public_key) - keep last (so private key from latest row wins)
  const byKey = new Map<string, (typeof toUpsert)[0]>()
  for (const rec of toUpsert) {
    byKey.set(`${rec.user_id}:${rec.public_key}`, rec)
  }
  const unique = Array.from(byKey.values())

  let toImport = unique
  if (LIMIT) {
    toImport = toImport.slice(0, LIMIT)
    console.log(`Limited to ${LIMIT} wallets`)
  }

  console.log(
    `Wallets: ${walletsRaw.length}, valid: ${unique.length}, skipped: ${skipNoUser + skipNoSupabase + skipNoPubkey} (no_user:${skipNoUser}, no_supabase:${skipNoSupabase}, no_pubkey:${skipNoPubkey}), to import: ${toImport.length}`
  )

  if (DRY_RUN) {
    console.log('[DRY RUN] Would upsert', toImport.length, 'wallets')
    if (toImport[0]) {
      const sample = { ...toImport[0], encrypted_private_key: toImport[0].encrypted_private_key ? '[REDACTED]' : null }
      console.log('Sample:', JSON.stringify(sample, null, 2))
    }
    return
  }

  if (toImport.length === 0) {
    console.log('Nothing to import.')
    return
  }

  let upserted = 0
  let errors = 0

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('wallets').upsert(batch, {
      onConflict: 'user_id,public_key',
      ignoreDuplicates: false,
    })

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message)
      errors += batch.length
      continue
    }

    upserted += batch.length
    const pct = (((i + batch.length) / toImport.length) * 100).toFixed(1)
    process.stdout.write(`\rProgress: ${i + batch.length}/${toImport.length} (${pct}%)`)
  }

  console.log('\nDone:', { upserted, errors })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

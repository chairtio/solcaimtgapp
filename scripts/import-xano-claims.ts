/**
 * Import Xano claims.csv into Supabase transactions table.
 *
 * XANO ID MAPPING (all use Xano internal IDs, NOT actual Telegram IDs):
 * - telegram_users.id         = Xano internal user ID (referenced everywhere)
 * - telegram_users.telegram_id = Actual Telegram ID (matches Supabase users.telegram_id)
 * - wallets.telegram_user_id  = References telegram_users.id
 * - claims.telegram_user_id   = References telegram_users.id
 * - claims.wallet_id          = References wallets.id
 *
 * Run: npx tsx scripts/import-xano-claims.ts
 *   --dry-run        Preview without inserting
 *   --limit N        Process only N claims
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

const CLAIMS_PATH = path.join(ROOT, 'xano', 'claims.csv')
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
      row[h] = vals[j] ?? ''
    })
    return row
  })
}

async function main() {
  if (!fs.existsSync(WALLETS_PATH)) {
    console.error(
      '\nMissing xano/wallets.csv\n\n' +
        'Export wallets from Xano with columns: id, telegram_user_id, public_key\n' +
        '(or id, user_id, public_key / address)\n'
    )
    process.exit(1)
  }

  // Load Xano data
  const claimsRaw = parseCSV(fs.readFileSync(CLAIMS_PATH, 'utf-8'))
  const walletsRaw = parseCSV(fs.readFileSync(WALLETS_PATH, 'utf-8'))
  const usersRaw = parseCSV(fs.readFileSync(USERS_PATH, 'utf-8'))

  // Map: Xano user id -> telegram_id
  const xanoUserIdToTelegram = new Map<string, string>()
  for (const u of usersRaw) {
    const xanoId = (u.id || u.telegram_user_id || '').trim()
    const telegramId = (u.telegram_id || '').trim()
    if (xanoId && telegramId) xanoUserIdToTelegram.set(xanoId, telegramId)
  }

  // Map: Xano wallet id -> { telegram_user_id, public_key }
  const pkCol = walletsRaw[0]?.public_key ? 'public_key' : walletsRaw[0]?.address ? 'address' : 'public_key'
  const userIdCol = walletsRaw[0]?.telegram_user_id
    ? 'telegram_user_id'
    : walletsRaw[0]?.user_id
      ? 'user_id'
      : 'telegram_user_id'

  const xanoWalletMap = new Map<string, { telegramUserId: string; publicKey: string }>()
  for (const w of walletsRaw) {
    const wid = (w.id || '').trim()
    const pubkey = (w[pkCol] || w.public_key || w.address || '').trim()
    const uid = (w[userIdCol] || w.user_id || '').trim()
    if (wid && pubkey && uid) {
      xanoWalletMap.set(wid, { telegramUserId: uid, publicKey: pubkey })
    }
  }

  // Fetch Supabase users by telegram_id (normalize to string for lookup)
  const { data: supabaseUsers } = await supabase.from('users').select('id, telegram_id')
  const telegramToSupabaseUser = new Map<string, string>()
  for (const u of supabaseUsers || []) {
    const tid = u.telegram_id != null ? String(u.telegram_id) : ''
    if (tid) telegramToSupabaseUser.set(tid, u.id)
  }

  // Get or create Supabase wallets: (user_id, public_key) -> wallet_id
  const walletCache = new Map<string, string>()
  async function getOrCreateWallet(supabaseUserId: string, publicKey: string): Promise<string | null> {
    const key = `${supabaseUserId}:${publicKey}`
    if (walletCache.has(key)) return walletCache.get(key)!

    if (DRY_RUN) {
      walletCache.set(key, `dry-${walletCache.size}`)
      return walletCache.get(key)!
    }

    const { data: existing } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', supabaseUserId)
      .eq('public_key', publicKey)
      .maybeSingle()

    if (existing?.id) {
      walletCache.set(key, existing.id)
      return existing.id
    }

    const { data: created, error } = await supabase
      .from('wallets')
      .insert({
        user_id: supabaseUserId,
        public_key: publicKey,
        status: 'active',
      })
      .select('id')
      .single()

    if (error) return null
    walletCache.set(key, created.id)
    return created.id
  }

  // Build transactions from claims
  const transactions: {
    wallet_id: string
    signature: string
    type: 'claim_rent'
    status: 'confirmed'
    sol_amount: number
    accounts_closed: number
    fee_amount: number
    created_at: string
    updated_at: string
  }[] = []

  let skipNoWallet = 0
  let skipNoUser = 0
  let skipNoSupabaseUser = 0
  let skipWalletCreate = 0

  for (const c of claimsRaw) {
    const xanoUserId = (c.telegram_user_id || '').trim()
    const walletInfo = xanoWalletMap.get((c.wallet_id || '').trim())
    if (!walletInfo) {
      skipNoWallet++
      continue
    }

    // telegram_users.id (Xano internal) -> telegram_users.telegram_id (actual)
    const telegramId = xanoUserIdToTelegram.get(xanoUserId)
    if (!telegramId) {
      skipNoUser++
      continue
    }

    // Supabase users.telegram_id (actual) -> users.id
    const supabaseUserId = telegramToSupabaseUser.get(String(telegramId))
    if (!supabaseUserId) {
      skipNoSupabaseUser++
      continue
    }

    const walletId = await getOrCreateWallet(supabaseUserId, walletInfo.publicKey)
    if (!walletId) {
      skipWalletCreate++
      continue
    }

    const createdMs = parseInt(c.created_at || '0', 10)
    const createdAt = isNaN(createdMs) ? new Date().toISOString() : new Date(createdMs).toISOString()

    const payoutAmount = parseFloat(c.payout_amount || c.amount || '0')
    const feeAmount = parseFloat(c.fee || '0')

    transactions.push({
      wallet_id: walletId,
      signature: (c.tx_id || c.signature || `claim_${c.id}`).trim(),
      type: 'claim_rent',
      status: 'confirmed',
      sol_amount: payoutAmount,
      accounts_closed: 1,
      fee_amount: feeAmount,
      created_at: createdAt,
      updated_at: createdAt,
    })
  }

  let toImport = transactions
  if (LIMIT) {
    toImport = toImport.slice(0, LIMIT)
    console.log(`Limited to ${LIMIT} claims`)
  }

  const totalSkipped = skipNoWallet + skipNoUser + skipNoSupabaseUser + skipWalletCreate
  console.log(
    `Claims: ${claimsRaw.length}, valid: ${transactions.length}, skipped: ${totalSkipped} (no_wallet:${skipNoWallet}, no_user:${skipNoUser}, no_supabase:${skipNoSupabaseUser}, wallet_fail:${skipWalletCreate}), to import: ${toImport.length}`
  )

  if (DRY_RUN) {
    console.log('[DRY RUN] Would insert', toImport.length, 'transactions')
    if (toImport[0]) console.log('Sample:', JSON.stringify(toImport[0], null, 2))
    return
  }

  if (toImport.length === 0) {
    console.log('Nothing to import.')
    return
  }

  let inserted = 0
  let errors = 0

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('transactions').insert(batch)

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message)
      errors += batch.length
      continue
    }

    inserted += batch.length
    const pct = ((i + batch.length) / toImport.length * 100).toFixed(1)
    process.stdout.write(`\rProgress: ${i + batch.length}/${toImport.length} (${pct}%)`)
  }

  console.log('\nDone:', { inserted, errors })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

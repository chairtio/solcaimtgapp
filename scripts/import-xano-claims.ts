/**
 * Import Xano claims.csv into Supabase transactions table.
 *
 * XANO ID MAPPING (all use Xano internal IDs, NOT actual Telegram IDs):
 * - telegram_users.id          = Xano internal user ID (referenced everywhere)
 * - telegram_users.telegram_id  = Actual Telegram ID (matches Supabase users.telegram_id)
 * - wallets.telegram_user_id    = References telegram_users.id
 * - claims.wallet_id           = References wallets.id (Xano)
 *
 * Run: npx tsx scripts/import-xano-claims.ts
 *   --dry-run        Preview without inserting
 *   --limit N        Process only N claims
 *
 * Requires: Run import-xano-users.ts and import-xano-wallets.ts first.
 * All wallets must exist in Supabase (no wallet creation).
 * Skips transactions that already exist (by signature).
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
      row[h.trim()] = vals[j] ?? ''
    })
    return row
  })
}

function getCol(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? ''
    if (v) return v.trim()
  }
  return ''
}

async function main() {
  if (!fs.existsSync(WALLETS_PATH)) {
    console.error('\nMissing xano/wallets.csv\n\nRun import-xano-wallets.ts first.')
    process.exit(1)
  }

  // Load Xano data
  const claimsRaw = parseCSV(fs.readFileSync(CLAIMS_PATH, 'utf-8'))
  const walletsRaw = parseCSV(fs.readFileSync(WALLETS_PATH, 'utf-8'))
  const usersRaw = parseCSV(fs.readFileSync(USERS_PATH, 'utf-8'))

  const walletsHeader = fs.readFileSync(WALLETS_PATH, 'utf-8').split(/\r?\n/)[0]?.split(',') ?? []
  const walletIdKey = walletsHeader.find((h) => h === 'id') ?? walletsHeader[0]
  const pkKey = walletsHeader.find((h) => h === 'public_key') ?? 'public_key'

  // Map: Xano user id -> telegram_id
  const xanoUserIdToTelegram = new Map<string, string>()
  for (const u of usersRaw) {
    const xanoId = (u.id ?? u.telegram_user_id ?? '').trim()
    const telegramId = (u.telegram_id ?? '').trim()
    if (xanoId && telegramId) xanoUserIdToTelegram.set(xanoId, telegramId)
  }

  // Map: Xano wallet id -> { telegram_user_id, public_key }
  const xanoWalletMap = new Map<string, { telegramUserId: string; publicKey: string }>()
  for (const w of walletsRaw) {
    const wid = getCol(w, [walletIdKey, 'id', walletsHeader[0]])
    const pubkey = getCol(w, [pkKey, 'public_key'])
    const uid = (w.telegram_user_id ?? w.user_id ?? '').trim()
    if (wid && pubkey && uid) {
      xanoWalletMap.set(wid, { telegramUserId: uid, publicKey: pubkey })
    }
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

  // Build xano_wallet_id -> supabase_wallet_id map (paginate - Supabase limits to 1000 rows/request)
  const xanoToSupabaseWallet = new Map<string, string>()
  const walletLookupKey = new Map<string, string>() // (user_id, public_key) -> supabase wallet_id
  let walletOffset = 0
  const walletChunk = 1000
  while (true) {
    const { data } = await supabase
      .from('wallets')
      .select('id, user_id, public_key')
      .order('id', { ascending: true })
      .range(walletOffset, walletOffset + walletChunk - 1)
    if (!data?.length) break
    for (const w of data) {
      walletLookupKey.set(`${w.user_id}:${w.public_key}`, w.id)
    }
    if (data.length < walletChunk) break
    walletOffset += walletChunk
  }

  for (const w of walletsRaw) {
    const xanoWid = getCol(w, [walletIdKey, 'id', walletsHeader[0]])
    const telegramUserId = (w.telegram_user_id ?? w.user_id ?? '').trim()
    const publicKey = getCol(w, [pkKey, 'public_key'])
    const telegramId = xanoUserIdToTelegram.get(telegramUserId)
    const supabaseUserId = telegramId ? telegramToSupabaseUser.get(telegramId) : null
    if (xanoWid && supabaseUserId && publicKey) {
      const supabaseWid = walletLookupKey.get(`${supabaseUserId}:${publicKey}`)
      if (supabaseWid) xanoToSupabaseWallet.set(xanoWid, supabaseWid)
    }
  }

  console.log(`Wallet map: ${xanoToSupabaseWallet.size} Xano wallets -> Supabase wallets`)

  // Fetch existing signatures for deduplication (ordered for deterministic pagination)
  const existingSignatures = new Set<string>()
  let sigOffset = 0
  const sigChunk = 10000
  while (true) {
    const { data } = await supabase
      .from('transactions')
      .select('signature')
      .order('id', { ascending: true })
      .range(sigOffset, sigOffset + sigChunk - 1)
    if (!data?.length) break
    data.forEach((r) => existingSignatures.add(r.signature))
    if (data.length < sigChunk) break
    sigOffset += sigChunk
  }
  console.log(`Existing signatures: ${existingSignatures.size}`)

  // Build transactions from claims (no wallet creation)
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
  let skipNoSupabaseWallet = 0
  let skipDupSignature = 0

  for (const c of claimsRaw) {
    const xanoWalletId = (c.wallet_id ?? '').trim()
    const walletInfo = xanoWalletMap.get(xanoWalletId)
    if (!walletInfo) {
      skipNoWallet++
      continue
    }

    const telegramId = xanoUserIdToTelegram.get((c.telegram_user_id ?? '').trim())
    if (!telegramId) {
      skipNoUser++
      continue
    }

    const supabaseUserId = telegramToSupabaseUser.get(String(telegramId))
    if (!supabaseUserId) {
      skipNoSupabaseUser++
      continue
    }

    const supabaseWalletId = xanoToSupabaseWallet.get(xanoWalletId)
    if (!supabaseWalletId) {
      skipNoSupabaseWallet++
      continue
    }

    const signature = (c.tx_id ?? c.signature ?? `claim_${c.id}`).trim()
    if (existingSignatures.has(signature)) {
      skipDupSignature++
      continue
    }

    const createdMs = parseInt(c.created_at ?? '0', 10)
    const createdAt = isNaN(createdMs) ? new Date().toISOString() : new Date(createdMs).toISOString()
    const payoutAmount = parseFloat(c.payout_amount ?? c.amount ?? '0')
    const feeAmount = parseFloat(c.fee ?? '0')

    transactions.push({
      wallet_id: supabaseWalletId,
      signature,
      type: 'claim_rent',
      status: 'confirmed',
      sol_amount: payoutAmount,
      accounts_closed: 1,
      fee_amount: feeAmount,
      created_at: createdAt,
      updated_at: createdAt,
    })
    existingSignatures.add(signature) // avoid duplicates within this run
  }

  let toImport = transactions
  if (LIMIT) {
    toImport = toImport.slice(0, LIMIT)
    console.log(`Limited to ${LIMIT} claims`)
  }

  const totalSkipped =
    skipNoWallet + skipNoUser + skipNoSupabaseUser + skipNoSupabaseWallet + skipDupSignature
  console.log(
    `Claims: ${claimsRaw.length}, valid: ${transactions.length}, skipped: ${totalSkipped} ` +
      `(no_wallet:${skipNoWallet}, no_user:${skipNoUser}, no_supabase_user:${skipNoSupabaseUser}, ` +
      `no_supabase_wallet:${skipNoSupabaseWallet}, dup_signature:${skipDupSignature}), to import: ${toImport.length}`
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
    const pct = (((i + batch.length) / toImport.length) * 100).toFixed(1)
    process.stdout.write(`\rProgress: ${i + batch.length}/${toImport.length} (${pct}%)`)
  }

  console.log('\nDone:', { inserted, errors })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
